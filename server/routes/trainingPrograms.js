const express = require('express');
const router = express.Router();
const TrainingProgram = require('../models/hr/TrainingProgram');
const { authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// @route   GET /api/training-programs
// @desc    Get all training programs with pagination and filters
// @access  Private (HR and Admin)
router.get('/',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      category,
      difficulty
    } = req.query;

    // Build query
    const query = {};
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { programId: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) query.status = status;
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      populate: [
        { path: 'courses', select: 'title courseId duration difficulty' },
        { path: 'createdBy', select: 'firstName lastName email' },
        { path: 'updatedBy', select: 'firstName lastName email' }
      ],
      sort: { createdAt: -1 }
    };

    const programs = await TrainingProgram.paginate(query, options);

    // Transform data to frontend format
    const transformedPrograms = {
      ...programs,
      docs: programs.docs.map(program => ({
        ...program.toObject(),
        objectives: program.learningObjectives,
        targetAudience: {
          roles: program.targetRoles,
          departments: program.targetDepartments,
          experienceLevel: program.targetExperienceLevel
        },
        completionCriteria: {
          requiredCourses: program.completionCriteria.allCoursesRequired ? program.courses.length : 1,
          minimumScore: program.completionCriteria.minimumScore,
          timeLimit: program.completionCriteria.timeLimit
        },
        providesCertificate: program.providesCertification,
        certificateTemplate: program.certificationName
      }))
    };

    res.json({
      success: true,
      data: transformedPrograms
    });
  })
);

// @route   GET /api/training-programs/:id
// @desc    Get training program by ID
// @access  Private (HR and Admin)
router.get('/:id',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const program = await TrainingProgram.findById(req.params.id)
      .populate('courses', 'title courseId duration difficulty category')
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email');

    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Training program not found'
      });
    }

    // Transform data to frontend format
    const transformedProgram = {
      ...program.toObject(),
      objectives: program.learningObjectives,
      targetAudience: {
        roles: program.targetRoles,
        departments: program.targetDepartments,
        experienceLevel: program.targetExperienceLevel
      },
      completionCriteria: {
        requiredCourses: program.completionCriteria.allCoursesRequired ? program.courses.length : 1,
        minimumScore: program.completionCriteria.minimumScore,
        timeLimit: program.completionCriteria.timeLimit
      },
      providesCertificate: program.providesCertification,
      certificateTemplate: program.certificationName
    };

    res.json({
      success: true,
      data: transformedProgram
    });
  })
);

// @route   POST /api/training-programs
// @desc    Create new training program
// @access  Private (HR and Admin)
router.post('/',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const {
      title,
      description,
      shortDescription,
      type,
      category,
      difficulty,
      objectives,
      prerequisites,
      courses,
      targetAudience,
      completionCriteria,
      maxEnrollments,
      providesCertificate,
      certificateTemplate,
      isActive,
      status
    } = req.body;

    // Create training program
    const program = new TrainingProgram({
      title,
      description,
      shortDescription,
      type,
      category,
      difficulty,
      learningObjectives: objectives, // Map objectives to learningObjectives
      prerequisites,
      courses,
      targetRoles: targetAudience?.roles || [],
      targetDepartments: targetAudience?.departments || [],
      targetExperienceLevel: targetAudience?.experienceLevel || 'all',
      completionCriteria: {
        allCoursesRequired: completionCriteria?.requiredCourses === courses?.length,
        minimumScore: completionCriteria?.minimumScore || 70,
        timeLimit: completionCriteria?.timeLimit || null
      },
      maxEnrollments,
      providesCertification: providesCertificate, // Map providesCertificate to providesCertification
      certificationName: certificateTemplate, // Map certificateTemplate to certificationName
      isActive,
      status,
      createdBy: req.user._id
    });

    await program.save();

    // Populate references
    await program.populate([
      { path: 'courses', select: 'title courseId duration difficulty' },
      { path: 'createdBy', select: 'firstName lastName email' }
    ]);

    // Transform data to frontend format
    const transformedProgram = {
      ...program.toObject(),
      objectives: program.learningObjectives,
      targetAudience: {
        roles: program.targetRoles,
        departments: program.targetDepartments,
        experienceLevel: program.targetExperienceLevel
      },
      completionCriteria: {
        requiredCourses: program.completionCriteria.allCoursesRequired ? program.courses.length : 1,
        minimumScore: program.completionCriteria.minimumScore,
        timeLimit: program.completionCriteria.timeLimit
      },
      providesCertificate: program.providesCertification,
      certificateTemplate: program.certificationName
    };

    res.status(201).json({
      success: true,
      message: 'Training program created successfully',
      data: transformedProgram
    });
  })
);

// @route   PUT /api/training-programs/:id
// @desc    Update training program
// @access  Private (HR and Admin)
router.put('/:id',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const program = await TrainingProgram.findById(req.params.id);

    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Training program not found'
      });
    }

    // Update fields
    const updateFields = [
      'title', 'description', 'shortDescription', 'type', 'category', 'difficulty',
      'prerequisites', 'courses',
      'maxEnrollments', 'isActive', 'status'
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        program[field] = req.body[field];
      }
    });

    // Handle objectives mapping
    if (req.body.objectives !== undefined) {
      program.learningObjectives = req.body.objectives;
    }

    // Handle target audience mapping
    if (req.body.targetAudience !== undefined) {
      program.targetRoles = req.body.targetAudience.roles || [];
      program.targetDepartments = req.body.targetAudience.departments || [];
      program.targetExperienceLevel = req.body.targetAudience.experienceLevel || 'all';
    }

    // Handle completion criteria mapping
    if (req.body.completionCriteria !== undefined) {
      program.completionCriteria = {
        allCoursesRequired: req.body.completionCriteria.requiredCourses === req.body.courses?.length,
        minimumScore: req.body.completionCriteria.minimumScore || 70,
        timeLimit: req.body.completionCriteria.timeLimit || null
      };
    }

    // Handle certification mapping
    if (req.body.providesCertificate !== undefined) {
      program.providesCertification = req.body.providesCertificate;
    }
    if (req.body.certificateTemplate !== undefined) {
      program.certificationName = req.body.certificateTemplate;
    }

    program.updatedBy = req.user._id;
    await program.save();

    // Populate references
    await program.populate([
      { path: 'courses', select: 'title courseId duration difficulty' },
      { path: 'createdBy', select: 'firstName lastName email' },
      { path: 'updatedBy', select: 'firstName lastName email' }
    ]);

    // Transform data to frontend format
    const transformedProgram = {
      ...program.toObject(),
      objectives: program.learningObjectives,
      targetAudience: {
        roles: program.targetRoles,
        departments: program.targetDepartments,
        experienceLevel: program.targetExperienceLevel
      },
      completionCriteria: {
        requiredCourses: program.completionCriteria.allCoursesRequired ? program.courses.length : 1,
        minimumScore: program.completionCriteria.minimumScore,
        timeLimit: program.completionCriteria.timeLimit
      },
      providesCertificate: program.providesCertification,
      certificateTemplate: program.certificationName
    };

    res.json({
      success: true,
      message: 'Training program updated successfully',
      data: transformedProgram
    });
  })
);

// @route   PUT /api/training-programs/:id/status
// @desc    Update training program status
// @access  Private (HR and Admin)
router.put('/:id/status',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const { status } = req.body;

    const program = await TrainingProgram.findById(req.params.id);

    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Training program not found'
      });
    }

    program.status = status;
    program.updatedBy = req.user._id;
    await program.save();

    res.json({
      success: true,
      message: 'Training program status updated successfully',
      data: program
    });
  })
);

// @route   DELETE /api/training-programs/:id
// @desc    Delete training program
// @access  Private (HR and Admin)
router.delete('/:id',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const program = await TrainingProgram.findById(req.params.id);

    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Training program not found'
      });
    }

    // Check if program has enrollments
    // This would require checking enrollments collection
    // For now, we'll allow deletion

    await program.deleteOne();

    res.json({
      success: true,
      message: 'Training program deleted successfully'
    });
  })
);

// @route   GET /api/training-programs/stats/overview
// @desc    Get training program statistics
// @access  Private (HR and Admin)
router.get('/stats/overview',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const [
      totalPrograms,
      activePrograms,
      draftPrograms,
      categoryStats,
      difficultyStats
    ] = await Promise.all([
      TrainingProgram.countDocuments(),
      TrainingProgram.countDocuments({ status: 'active' }),
      TrainingProgram.countDocuments({ status: 'draft' }),
      TrainingProgram.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      TrainingProgram.aggregate([
        { $group: { _id: '$difficulty', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        totalPrograms,
        activePrograms,
        draftPrograms,
        categoryStats,
        difficultyStats
      }
    });
  })
);

module.exports = router; 