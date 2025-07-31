const express = require('express');
const { authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const Enrollment = require('../models/hr/Enrollment');
const Course = require('../models/hr/Course');
const Employee = require('../models/hr/Employee');

const router = express.Router();

// @route   GET /api/enrollments
// @desc    Get all enrollments with pagination and filters
// @access  Private (HR and Admin)
router.get('/', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      status,
      enrollmentType,
      employee,
      course,
      search
    } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (enrollmentType) filter.enrollmentType = enrollmentType;
    if (employee) filter.employee = employee;
    if (course) filter.course = course;
    if (search) {
      filter.$or = [
        { enrollmentId: { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: 'employee', select: 'firstName lastName email employeeId department' },
        { path: 'course', select: 'title courseId category duration' },
        { path: 'assignedBy', select: 'firstName lastName' },
        { path: 'createdBy', select: 'firstName lastName' }
      ]
    };

    const enrollments = await Enrollment.paginate(filter, options);

    res.json({
      success: true,
      data: enrollments
    });
  })
);

// @route   GET /api/enrollments/:id
// @desc    Get enrollment by ID
// @access  Private (HR and Admin)
router.get('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const enrollment = await Enrollment.findById(req.params.id)
      .populate('employee', 'firstName lastName email employeeId department')
      .populate('course')
      .populate('assignedBy', 'firstName lastName')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    res.json({
      success: true,
      data: enrollment
    });
  })
);

// @route   POST /api/enrollments
// @desc    Create new enrollment
// @access  Private (HR and Admin)
router.post('/', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const {
      employee,
      course,
      enrollmentType,
      assignedBy,
      dueDate,
      notes
    } = req.body;

    // Validate required fields
    if (!employee || !course) {
      return res.status(400).json({
        success: false,
        message: 'Employee and course are required'
      });
    }

    // Check if employee exists
    const employeeDoc = await Employee.findById(employee);
    if (!employeeDoc) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Check if course exists and is published
    const courseDoc = await Course.findById(course);
    if (!courseDoc) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (courseDoc.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: 'Cannot enroll in unpublished course'
      });
    }

    // Check if enrollment already exists
    const existingEnrollment = await Enrollment.findOne({
      employee,
      course
    });

    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        message: 'Enrollment already exists for this employee and course'
      });
    }

    const enrollment = new Enrollment({
      employee,
      course,
      enrollmentType: enrollmentType || 'assigned',
      assignedBy: assignedBy || req.user._id,
      assignedAt: new Date(),
      dueDate,
      notes: notes ? [{ content: notes, type: 'general', createdBy: req.user._id }] : [],
      createdBy: req.user._id
    });

    await enrollment.save();

    // Update course enrollment count
    courseDoc.currentEnrollments += 1;
    await courseDoc.save();

    res.status(201).json({
      success: true,
      message: 'Enrollment created successfully',
      data: enrollment
    });
  })
);

// @route   PUT /api/enrollments/:id
// @desc    Update enrollment
// @access  Private (HR and Admin)
router.put('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const enrollment = await Enrollment.findById(req.params.id);

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    // Update fields if provided
    const updateFields = [
      'employee', 'course', 'enrollmentType', 'status', 'progress', 
      'rating', 'review'
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        enrollment[field] = req.body[field];
      }
    });

    // Handle dueDate separately to ensure proper date conversion
    if (req.body.dueDate !== undefined) {
      enrollment.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
    }

    // Handle notes update
    if (req.body.notes !== undefined) {
      enrollment.notes = [{ content: req.body.notes, createdAt: new Date() }];
    }

    // Handle review submission
    if (req.body.review && !enrollment.reviewSubmittedAt) {
      enrollment.reviewSubmittedAt = new Date();
    }

    enrollment.updatedBy = req.user._id;
    await enrollment.save();

    // Populate the updated enrollment with related data
    const updatedEnrollment = await Enrollment.findById(enrollment._id)
      .populate('employee', 'firstName lastName email employeeId department')
      .populate('course', 'title courseId category duration')
      .populate('assignedBy', 'firstName lastName')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Enrollment updated successfully',
      data: updatedEnrollment
    });
  })
);

// @route   PUT /api/enrollments/:id/status
// @desc    Update enrollment status
// @access  Private (HR and Admin)
router.put('/:id/status', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const enrollment = await Enrollment.findById(req.params.id);

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    enrollment.status = status;
    enrollment.updatedBy = req.user._id;
    await enrollment.save();

    res.json({
      success: true,
      message: 'Enrollment status updated successfully',
      data: enrollment
    });
  })
);

// @route   POST /api/enrollments/:id/progress
// @desc    Update enrollment progress
// @access  Private (HR and Admin)
router.post('/:id/progress', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const {
      materialId,
      timeSpent,
      score,
      progress
    } = req.body;

    const enrollment = await Enrollment.findById(req.params.id);

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    // Update progress
    if (progress !== undefined) {
      enrollment.progress = progress;
    }

    // Add completed material
    if (materialId) {
      const existingMaterial = enrollment.completedMaterials.find(
        material => material.materialId.toString() === materialId
      );

      if (!existingMaterial) {
        enrollment.completedMaterials.push({
          materialId,
          timeSpent,
          score
        });
      }
    }

    // Update total time spent
    if (timeSpent) {
      enrollment.totalTimeSpent += timeSpent;
    }

    enrollment.lastAccessedAt = new Date();
    enrollment.updatedBy = req.user._id;
    await enrollment.save();

    res.json({
      success: true,
      message: 'Progress updated successfully',
      data: enrollment
    });
  })
);

// @route   POST /api/enrollments/:id/assessment
// @desc    Submit assessment attempt
// @access  Private (HR and Admin)
router.post('/:id/assessment', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const {
      score,
      answers
    } = req.body;

    if (score === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Score is required'
      });
    }

    const enrollment = await Enrollment.findById(req.params.id);

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    // Get course to check passing score
    const course = await Course.findById(enrollment.course);
    const passingScore = course ? course.passingScore : 70;

    const attemptNumber = enrollment.assessmentAttempts.length + 1;
    const passed = score >= passingScore;

    enrollment.assessmentAttempts.push({
      attemptNumber,
      score,
      passed,
      answers: answers || []
    });

    // Update status if passed
    if (passed) {
      enrollment.status = 'completed';
      enrollment.progress = 100;
    }

    enrollment.updatedBy = req.user._id;
    await enrollment.save();

    res.json({
      success: true,
      message: 'Assessment submitted successfully',
      data: {
        attemptNumber,
        score,
        passed,
        passingScore
      }
    });
  })
);

// @route   POST /api/enrollments/:id/rating
// @desc    Submit course rating and review
// @access  Private (HR and Admin)
router.post('/:id/rating', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const enrollment = await Enrollment.findById(req.params.id)
      .populate('course');

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    // Check if enrollment is completed
    if (enrollment.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'You can only rate courses after completion'
      });
    }

    // Check if already rated
    if (enrollment.rating) {
      return res.status(400).json({
        success: false,
        message: 'You have already rated this course'
      });
    }

    // Update enrollment with rating and review
    enrollment.rating = rating;
    enrollment.review = review;
    enrollment.reviewSubmittedAt = new Date();
    enrollment.updatedBy = req.user._id;
    await enrollment.save();

    // Update course rating
    const course = enrollment.course;
    if (course) {
      // Get all ratings for this course
      const courseEnrollments = await Enrollment.find({
        course: course._id,
        rating: { $exists: true, $ne: null }
      });

      const totalRating = courseEnrollments.reduce((sum, enrollment) => sum + enrollment.rating, 0);
      const averageRating = totalRating / courseEnrollments.length;

      course.rating = {
        average: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
        count: courseEnrollments.length
      };

      await course.save();
    }

    res.json({
      success: true,
      message: 'Rating submitted successfully',
      data: {
        enrollment,
        courseRating: course?.rating
      }
    });
  })
);

// @route   POST /api/enrollments/:id/complete
// @desc    Mark enrollment as completed
// @access  Private (HR and Admin)
router.post('/:id/complete', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const enrollment = await Enrollment.findById(req.params.id)
      .populate('course');

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    const course = enrollment.course;

    // Check if all required materials are completed
    const requiredMaterials = course.materials.filter(material => material.isRequired);
    const completedRequiredMaterials = enrollment.completedMaterials.filter(material => {
      const courseMaterial = requiredMaterials.find(cm => cm._id.toString() === material.materialId.toString());
      return courseMaterial;
    });

    if (completedRequiredMaterials.length < requiredMaterials.length) {
      return res.status(400).json({
        success: false,
        message: `You must complete all required materials. ${completedRequiredMaterials.length}/${requiredMaterials.length} completed.`
      });
    }

    // Check if assessment is required and passed
    if (course.hasAssessment) {
      const passedAttempt = enrollment.assessmentAttempts.find(attempt => attempt.passed);
      if (!passedAttempt) {
        return res.status(400).json({
          success: false,
          message: 'You must pass the course assessment to complete the course.'
        });
      }
    }

    // Mark as completed
    enrollment.status = 'completed';
    enrollment.progress = 100;
    enrollment.completedAt = new Date();
    enrollment.updatedBy = req.user._id;
    await enrollment.save();

    // Update course enrollment count if needed
    if (course) {
      // This could be used for analytics
      console.log(`Course ${course.title} completed by enrollment ${enrollment._id}`);
    }

    res.json({
      success: true,
      message: 'Course completed successfully! You can now rate this course.',
      data: {
        enrollment,
        canRate: true,
        completionDate: enrollment.completedAt
      }
    });
  })
);

// @route   GET /api/enrollments/:id/completion-status
// @desc    Get enrollment completion status and requirements
// @access  Private (HR and Admin)
router.get('/:id/completion-status', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const enrollment = await Enrollment.findById(req.params.id)
      .populate('course');

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    const course = enrollment.course;
    const requiredMaterials = course.materials.filter(material => material.isRequired);
    const completedRequiredMaterials = enrollment.completedMaterials.filter(material => {
      const courseMaterial = requiredMaterials.find(cm => cm._id.toString() === material.materialId.toString());
      return courseMaterial;
    });

    const materialProgress = requiredMaterials.map(material => {
      const completed = enrollment.completedMaterials.find(cm => 
        cm.materialId.toString() === material._id.toString()
      );
      return {
        materialId: material._id,
        title: material.title,
        type: material.type,
        isCompleted: !!completed,
        completedAt: completed?.completedAt,
        timeSpent: completed?.timeSpent
      };
    });

    const assessmentStatus = course.hasAssessment ? {
      isRequired: true,
      attempts: enrollment.assessmentAttempts.length,
      maxAttempts: course.maxAttempts,
      bestScore: enrollment.assessmentAttempts.length > 0 ? 
        Math.max(...enrollment.assessmentAttempts.map(a => a.score)) : 0,
      passed: enrollment.assessmentAttempts.some(attempt => attempt.passed),
      passingScore: course.passingScore
    } : {
      isRequired: false
    };

    const canComplete = completedRequiredMaterials.length >= requiredMaterials.length && 
      (!course.hasAssessment || assessmentStatus.passed);

    res.json({
      success: true,
      data: {
        enrollmentId: enrollment._id,
        courseTitle: course.title,
        status: enrollment.status,
        progress: enrollment.progress,
        totalTimeSpent: enrollment.totalTimeSpent,
        materialProgress,
        assessmentStatus,
        canComplete,
        requirements: {
          totalRequiredMaterials: requiredMaterials.length,
          completedRequiredMaterials: completedRequiredMaterials.length,
          assessmentRequired: course.hasAssessment,
          assessmentPassed: assessmentStatus.passed || !course.hasAssessment
        }
      }
    });
  })
);

// @route   DELETE /api/enrollments/:id
// @desc    Delete enrollment
// @access  Private (HR and Admin)
router.delete('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const enrollment = await Enrollment.findById(req.params.id);

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    // Update course enrollment count
    const course = await Course.findById(enrollment.course);
    if (course) {
      course.currentEnrollments = Math.max(0, course.currentEnrollments - 1);
      await course.save();
    }

    await enrollment.deleteOne();

    res.json({
      success: true,
      message: 'Enrollment deleted successfully'
    });
  })
);

// @route   GET /api/enrollments/stats/overview
// @desc    Get enrollment statistics overview
// @access  Private (HR and Admin)
router.get('/stats/overview', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const totalEnrollments = await Enrollment.countDocuments();
    const activeEnrollments = await Enrollment.countDocuments({ status: { $in: ['enrolled', 'in_progress'] } });
    const completedEnrollments = await Enrollment.countDocuments({ status: 'completed' });
    const droppedEnrollments = await Enrollment.countDocuments({ status: 'dropped' });

    // Status breakdown
    const statusStats = await Enrollment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Enrollment type breakdown
    const typeStats = await Enrollment.aggregate([
      {
        $group: {
          _id: '$enrollmentType',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Average progress
    const progressStats = await Enrollment.aggregate([
      {
        $group: {
          _id: null,
          averageProgress: { $avg: '$progress' },
          averageTimeSpent: { $avg: '$totalTimeSpent' }
        }
      }
    ]);

    // Recent enrollments
    const recentEnrollments = await Enrollment.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('employee', 'firstName lastName')
      .populate('course', 'title courseId');

    res.json({
      success: true,
      data: {
        totalEnrollments,
        activeEnrollments,
        completedEnrollments,
        droppedEnrollments,
        statusStats,
        typeStats,
        progressStats: progressStats[0] || { averageProgress: 0, averageTimeSpent: 0 },
        recentEnrollments
      }
    });
  })
);

// @route   GET /api/enrollments/stats/recent
// @desc    Get recent enrollments with detailed information
// @access  Private (HR and Admin)
router.get('/stats/recent', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { limit = 10 } = req.query;

    const recentEnrollments = await Enrollment.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('employee', 'firstName lastName email employeeId department')
      .populate('course', 'title courseId category duration')
      .populate('assignedBy', 'firstName lastName')
      .select('status progress totalTimeSpent enrolledDate dueDate createdAt');

    // Transform the data for frontend consumption
    const transformedEnrollments = recentEnrollments.map(enrollment => ({
      _id: enrollment._id,
      employee: enrollment.employee ? {
        name: `${enrollment.employee.firstName} ${enrollment.employee.lastName}`,
        email: enrollment.employee.email,
        employeeId: enrollment.employee.employeeId,
        department: enrollment.employee.department
      } : null,
      course: enrollment.course ? {
        title: enrollment.course.title,
        courseId: enrollment.course.courseId,
        category: enrollment.course.category,
        duration: enrollment.course.duration
      } : null,
      status: enrollment.status,
      progress: enrollment.progress || 0,
      totalTimeSpent: enrollment.totalTimeSpent || 0,
      enrolledDate: enrollment.enrolledDate || enrollment.createdAt,
      dueDate: enrollment.dueDate,
      assignedBy: enrollment.assignedBy ? {
        name: `${enrollment.assignedBy.firstName} ${enrollment.assignedBy.lastName}`
      } : null
    }));

    res.json({
      success: true,
      data: transformedEnrollments
    });
  })
);

module.exports = router; 