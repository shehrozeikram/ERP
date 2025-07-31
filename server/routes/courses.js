const express = require('express');
const { authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const Course = require('../models/hr/Course');
const Enrollment = require('../models/hr/Enrollment');

const router = express.Router();

// @route   GET /api/courses
// @desc    Get all courses with pagination and filters
// @access  Private (HR and Admin)
router.get('/', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      status,
      category,
      difficulty,
      search,
      featured,
      isPublic
    } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (difficulty) filter.difficulty = difficulty;
    if (featured !== undefined) filter.featured = featured === 'true';
    if (isPublic !== undefined) filter.isPublic = isPublic === 'true';
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { courseId: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: 'createdBy', select: 'firstName lastName' },
        { path: 'updatedBy', select: 'firstName lastName' }
      ]
    };

    const courses = await Course.paginate(filter, options);

    res.json({
      success: true,
      data: courses
    });
  })
);

// @route   GET /api/courses/:id
// @desc    Get course by ID
// @access  Private (HR and Admin)
router.get('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const course = await Course.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.json({
      success: true,
      data: course
    });
  })
);

// @route   POST /api/courses
// @desc    Create new course
// @access  Private (HR and Admin)
router.post('/', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const {
      title,
      description,
      shortDescription,
      category,
      subcategory,
      tags,
      duration,
      difficulty,
      learningObjectives,
      prerequisites,
      materials,
      hasAssessment,
      passingScore,
      maxAttempts,
      status,
      isPublic,
      maxEnrollments,
      providesCertificate,
      certificateTemplate
    } = req.body;

    // Validate required fields
    if (!title || !description || !category || !duration) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, category, and duration are required'
      });
    }

    const course = new Course({
      title,
      description,
      shortDescription,
      category,
      subcategory,
      tags: tags || [],
      duration,
      difficulty: difficulty || 'beginner',
      learningObjectives: learningObjectives || [],
      prerequisites: prerequisites || [],
      materials: materials || [],
      hasAssessment: hasAssessment || false,
      passingScore: passingScore || 70,
      maxAttempts: maxAttempts || 3,
      status: status || 'draft',
      isPublic: isPublic || false,
      maxEnrollments: maxEnrollments || null,
      providesCertificate: providesCertificate || false,
      certificateTemplate,
      createdBy: req.user._id
    });

    await course.save();

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: course
    });
  })
);

// @route   PUT /api/courses/:id
// @desc    Update course
// @access  Private (HR and Admin)
router.put('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Update fields if provided
    const updateFields = [
      'title', 'description', 'shortDescription', 'category', 'subcategory',
      'tags', 'duration', 'difficulty', 'learningObjectives', 'prerequisites',
      'materials', 'hasAssessment', 'passingScore', 'maxAttempts', 'status',
      'isPublic', 'maxEnrollments', 'providesCertificate', 'certificateTemplate',
      'featured', 'isActive'
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        course[field] = req.body[field];
      }
    });

    course.updatedBy = req.user._id;
    await course.save();

    res.json({
      success: true,
      message: 'Course updated successfully',
      data: course
    });
  })
);

// @route   DELETE /api/courses/:id
// @desc    Delete course
// @access  Private (HR and Admin)
router.delete('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if there are any enrollments
    const enrollments = await Enrollment.find({ course: req.params.id });
    if (enrollments.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete course with existing enrollments'
      });
    }

    await course.deleteOne();

    res.json({
      success: true,
      message: 'Course deleted successfully'
    });
  })
);

// @route   PUT /api/courses/:id/status
// @desc    Update course status
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

    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    course.status = status;
    course.updatedBy = req.user._id;
    await course.save();

    res.json({
      success: true,
      message: 'Course status updated successfully',
      data: course
    });
  })
);

// @route   GET /api/courses/:id/enrollments
// @desc    Get course enrollments
// @access  Private (HR and Admin)
router.get('/:id/enrollments', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status } = req.query;

    const filter = { course: req.params.id };
    if (status) filter.status = status;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: 'employee', select: 'firstName lastName email employeeId department' },
        { path: 'assignedBy', select: 'firstName lastName' }
      ]
    };

    const enrollments = await Enrollment.paginate(filter, options);

    res.json({
      success: true,
      data: enrollments
    });
  })
);

// @route   GET /api/courses/stats/overview
// @desc    Get course statistics overview
// @access  Private (HR and Admin)
router.get('/stats/overview', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const totalCourses = await Course.countDocuments();
    const publishedCourses = await Course.countDocuments({ status: 'published' });
    const draftCourses = await Course.countDocuments({ status: 'draft' });
    const archivedCourses = await Course.countDocuments({ status: 'archived' });
    
    const totalEnrollments = await Enrollment.countDocuments();
    const activeEnrollments = await Enrollment.countDocuments({ status: { $in: ['enrolled', 'in_progress'] } });
    const completedEnrollments = await Enrollment.countDocuments({ status: 'completed' });

    // Category breakdown
    const categoryStats = await Course.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Difficulty breakdown
    const difficultyStats = await Course.aggregate([
      {
        $group: {
          _id: '$difficulty',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Recent courses
    const recentCourses = await Course.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title courseId status createdAt');

    res.json({
      success: true,
      data: {
        totalCourses,
        publishedCourses,
        draftCourses,
        archivedCourses,
        totalEnrollments,
        activeEnrollments,
        completedEnrollments,
        categoryStats,
        difficultyStats,
        recentCourses
      }
    });
  })
);

// @route   GET /api/courses/stats/top-performing
// @desc    Get top performing courses with enrollment and completion data
// @access  Private (HR and Admin)
router.get('/stats/top-performing', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { limit = 10 } = req.query;

    // Get top performing courses based on enrollments and completion rates
    const topCourses = await Course.aggregate([
      {
        $lookup: {
          from: 'enrollments',
          localField: '_id',
          foreignField: 'course',
          as: 'enrollments'
        }
      },
      {
        $addFields: {
          totalEnrollments: { $size: '$enrollments' },
          completedEnrollments: {
            $size: {
              $filter: {
                input: '$enrollments',
                cond: { $eq: ['$$this.status', 'completed'] }
              }
            }
          },
          inProgressEnrollments: {
            $size: {
              $filter: {
                input: '$enrollments',
                cond: { $eq: ['$$this.status', 'in_progress'] }
              }
            }
          }
        }
      },
      {
        $addFields: {
          completionRate: {
            $cond: {
              if: { $gt: ['$totalEnrollments', 0] },
              then: {
                $round: [
                  { $multiply: [{ $divide: ['$completedEnrollments', '$totalEnrollments'] }, 100] },
                  1
                ]
              },
              else: 0
            }
          },
          averageRating: {
            $cond: {
              if: { $gt: ['$rating.count', 0] },
              then: { $round: ['$rating.average', 1] },
              else: 0
            }
          }
        }
      },
      {
        $match: {
          totalEnrollments: { $gt: 0 }
        }
      },
      {
        $sort: {
          totalEnrollments: -1,
          completionRate: -1
        }
      },
      {
        $limit: parseInt(limit)
      },
      {
        $project: {
          _id: 1,
          title: 1,
          courseId: 1,
          category: 1,
          totalEnrollments: 1,
          completedEnrollments: 1,
          inProgressEnrollments: 1,
          completionRate: 1,
          averageRating: 1,
          duration: 1,
          difficulty: 1
        }
      }
    ]);

    res.json({
      success: true,
      data: topCourses
    });
  })
);

module.exports = router; 