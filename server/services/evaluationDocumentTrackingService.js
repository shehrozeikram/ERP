const mongoose = require('mongoose');
const EvaluationDocumentTracking = require('../models/hr/EvaluationDocumentTracking');
const DocumentMaster = require('../models/hr/DocumentMaster');
const DocumentMovement = require('../models/hr/DocumentMovement');
const User = require('../models/User');
const Employee = require('../models/hr/Employee');

const MODULE_NAME = 'Evaluation & Appraisal';

const buildHolder = (type, data = {}) => ({
  type,
  name: data.name || '',
  email: data.email || '',
  designation: data.designation || '',
  receivedAt: data.receivedAt || new Date()
});

const toObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === 'object' && value._id) {
    return value._id instanceof mongoose.Types.ObjectId
      ? value._id
      : mongoose.Types.ObjectId.createFromHexString(value._id.toString());
  }
  if (mongoose.Types.ObjectId.isValid(value)) {
    return mongoose.Types.ObjectId.createFromHexString(value.toString());
  }
  return null;
};

const mapStatusToDocumentTracking = (document) => {
  if (!document) return 'Registered';
  if (document.status === 'archived') return 'Archived';
  if (document.status === 'completed' || document.approvalStatus === 'approved') return 'Completed';
  if (document.approvalStatus === 'in_progress') return 'In Approval';
  if (document.status === 'submitted') return 'In Review';
  if (document.status === 'in_progress') return 'In Review';
  if (document.status === 'sent') return 'Sent';
  if (document.approvalStatus === 'rejected' || document.status === 'rejected') return 'In Review';
  return 'Registered';
};

const loadEmployee = async (employee) => {
  if (!employee) return null;
  if (typeof employee === 'object' && (employee.firstName || employee.name)) {
    return employee;
  }

  return Employee.findById(employee)
    .populate('placementDepartment placementDesignation user');
};

const resolveUserFromEmployee = async (employee) => {
  if (!employee) return null;
  if (!(typeof employee === 'object' && (employee.firstName || employee.name))) {
    const hydrated = await loadEmployee(employee);
    if (!hydrated) return null;
    return resolveUserFromEmployee(hydrated);
  }

  if (employee.user) {
    if (typeof employee.user === 'object' && employee.user._id) {
      return employee.user;
    }
    return User.findById(employee.user).select('firstName lastName email department position employeeId');
  }

  if (employee.email) {
    const userByEmail = await User.findOne({ email: employee.email.toLowerCase() })
      .select('firstName lastName email department position employeeId');
    if (userByEmail) return userByEmail;
  }

  if (employee.employeeId) {
    return User.findOne({ employeeId: employee.employeeId })
      .select('firstName lastName email department position employeeId');
  }

  return null;
};

const buildModuleMeta = (document, employee, evaluator) => {
  const employeeName = employee
    ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim()
    : document.name || '';
  const evaluatorName = evaluator
    ? `${evaluator.firstName || ''} ${evaluator.lastName || ''}`.trim()
    : '';

  return {
    employee: {
      id: employee?._id || document.employee,
      name: employeeName,
      code: employee?.employeeId || document.code,
      designation: employee?.placementDesignation?.title || document.designation || '',
      department: toObjectId(employee?.placementDepartment || document.department)
    },
    evaluator: {
      id: evaluator?._id || document.evaluator,
      name: evaluatorName,
      email: evaluator?.email || ''
    },
    formType: document.formType,
    status: document.status,
    approvalStatus: document.approvalStatus,
    currentApprovalLevel: document.currentApprovalLevel,
    updatedAt: new Date()
  };
};

const syncDocumentMaster = async ({
  document,
  actorUser,
  holderEmployee,
  employeeDoc,
  evaluatorDoc,
  reason,
  comments,
  statusOverride,
  movementType
}) => {
  if (!document?._id || !actorUser?._id) return;

  const hydratedEmployee = await loadEmployee(employeeDoc || document.employee);
  const hydratedEvaluator = await loadEmployee(evaluatorDoc || document.evaluator);
  const hydratedHolder = await loadEmployee(holderEmployee || hydratedEvaluator || hydratedEmployee);

  const masterStatus = statusOverride || mapStatusToDocumentTracking(document);
  const meta = buildModuleMeta(document, hydratedEmployee || hydratedHolder, hydratedEvaluator);

  const holderUser = hydratedHolder ? await resolveUserFromEmployee(hydratedHolder) : actorUser;
  const holderDepartment =
    toObjectId(hydratedHolder?.placementDepartment) ||
    toObjectId(document.department) ||
    toObjectId(actorUser.department);

  let master = await DocumentMaster.findOne({
    module: MODULE_NAME,
    moduleDocumentId: document._id
  });

  const holderPayload = holderUser?._id ? {
    user: holderUser._id,
    department: holderDepartment,
    receivedAt: new Date()
  } : undefined;

  const docName = `Evaluation - ${meta.employee.name || document._id}`;

  if (!master) {
    master = new DocumentMaster({
      name: docName,
      category: MODULE_NAME,
      type: document.formType === 'white_collar' ? 'White Collar Appraisal' : 'Blue Collar Appraisal',
      owner: actorUser._id,
      status: masterStatus,
      priority: 'Medium',
      dueDate: document.reviewPeriodTo || document.submittedAt || document.completedAt || new Date(),
      module: MODULE_NAME,
      moduleDocumentId: document._id,
      moduleDocumentType: 'EvaluationDocument',
      moduleMeta: meta,
      currentHolder: holderPayload,
      createdBy: actorUser._id,
      updatedBy: actorUser._id
    });
    await master.save();

    if (holderPayload) {
      const initialDepartment =
        holderPayload.department ||
        toObjectId(document.department) ||
        toObjectId(hydratedEmployee?.placementDepartment);

      if (initialDepartment) {
        await DocumentMovement.create({
          document: master._id,
          toDepartment: initialDepartment,
          toUser: holderPayload.user,
          reason: reason || 'Evaluation document registered',
          comments,
          statusBefore: 'Registered',
          statusAfter: masterStatus,
          movementType: movementType || 'Status Change',
          createdBy: actorUser._id
        });
      }
    }

    return master;
  }

  const previousStatus = master.status;
  const previousHolder = master.currentHolder ? { ...master.currentHolder } : null;

  master.status = masterStatus;
  master.moduleMeta = meta;
  if (holderPayload) {
    master.currentHolder = holderPayload;
  }
  master.updatedBy = actorUser._id;

  await master.save();

  const holderChanged = holderPayload && (!previousHolder?.user || previousHolder.user.toString() !== holderPayload.user.toString());
  const statusChanged = previousStatus !== masterStatus;

  if ((holderPayload || previousHolder) && (holderChanged || statusChanged)) {
    const toDepartment =
      holderPayload?.department ||
      previousHolder?.department ||
      toObjectId(document.department) ||
      toObjectId(hydratedEmployee?.placementDepartment);

    if (toDepartment) {
      await DocumentMovement.create({
        document: master._id,
        fromDepartment: previousHolder?.department || null,
        toDepartment,
        fromUser: previousHolder?.user || null,
        toUser: holderPayload?.user || previousHolder?.user || actorUser._id,
        reason: reason || 'Evaluation document updated',
        comments,
        statusBefore: previousStatus || 'Registered',
        statusAfter: masterStatus,
        movementType: movementType || (holderChanged ? 'Transfer' : 'Status Change'),
        createdBy: actorUser._id
      });
    }
  }

  return master;
};

const logEvent = async (document, { status, action, holder = buildHolder('system'), comments }) => {
  if (!document?._id) return;

  await EvaluationDocumentTracking.findOneAndUpdate(
    { evaluationDocument: document._id },
    {
      $setOnInsert: {
        evaluationDocument: document._id,
        employee: document.employee,
        module: MODULE_NAME
      },
      $set: {
        employeeName: document.name || '',
        formType: document.formType,
        status,
        currentHolder: holder
      },
      $push: {
        timeline: {
          status,
          action,
          comments: comments || '',
          holder,
          timestamp: new Date()
        }
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const logSend = async ({ document, evaluator, employee, actorUser }) => {
  const holder = buildHolder('evaluator', {
    name: evaluator ? `${evaluator.firstName} ${evaluator.lastName}`.trim() : '',
    email: evaluator?.email,
    designation: evaluator?.placementDesignation?.title
  });

  await logEvent(document, {
    status: 'sent',
    action: 'sent',
    holder
  });

  await syncDocumentMaster({
    document,
    actorUser,
    holderEmployee: evaluator,
    employeeDoc: employee,
    evaluatorDoc: evaluator,
    reason: 'Sent to evaluator',
    movementType: 'Transfer'
  });
};

const logSubmission = async (document, actorUser) => {
  await logEvent(document, {
    status: 'submitted',
    action: 'submitted',
    holder: buildHolder('system', { name: 'System' })
  });

  await syncDocumentMaster({
    document,
    actorUser,
    holderEmployee: null,
    employeeDoc: document.employee,
    evaluatorDoc: document.evaluator,
    reason: 'Submitted to HR',
    movementType: 'Status Change'
  });
};

const logApproval = async ({ document, nextLevel, actorUser }) => {
  const isCompleted = document.approvalStatus === 'approved';

  if (isCompleted) {
    await logEvent(document, {
      status: 'completed',
      action: 'approved',
      holder: buildHolder('system', { name: 'System' })
    });

    await syncDocumentMaster({
      document,
      actorUser,
      holderEmployee: document.employee,
      employeeDoc: document.employee,
      evaluatorDoc: document.evaluator,
      reason: 'Evaluation completed',
      statusOverride: 'Completed',
      movementType: 'Status Change'
    });
    return;
  }

  if (!nextLevel) {
    await logEvent(document, {
      status: 'in_approval',
      action: 'approved',
      holder: buildHolder('system', { name: 'System' })
    });

    await syncDocumentMaster({
      document,
      actorUser,
      holderEmployee: null,
      employeeDoc: document.employee,
      evaluatorDoc: document.evaluator,
      reason: 'Moved within approval flow'
    });
    return;
  }

  const holder = buildHolder('approver', {
    name: nextLevel.approverName || nextLevel.title,
    email: nextLevel.approverEmail,
    designation: nextLevel.title
  });

  await logEvent(document, {
    status: 'in_approval',
    action: 'moved_to_next_level',
    holder
  });

  let nextApproverEmployee = null;
  if (nextLevel.approver) {
    nextApproverEmployee = typeof nextLevel.approver === 'object'
      ? nextLevel.approver
      : await Employee.findById(nextLevel.approver)
          .populate('placementDepartment placementDesignation user');
  }

  await syncDocumentMaster({
    document,
    actorUser,
    holderEmployee: nextApproverEmployee,
    employeeDoc: document.employee,
    evaluatorDoc: document.evaluator,
    reason: `Moved to ${nextLevel.title}`,
    movementType: 'Transfer'
  });
};

const logRejection = async ({ document, levelData, comments, actorUser }) => {
  await logEvent(document, {
    status: 'rejected',
    action: 'rejected',
    comments,
    holder: buildHolder('system', {
      name: levelData?.approverName || levelData?.title || 'Approver'
    })
  });

  await syncDocumentMaster({
    document,
    actorUser,
    holderEmployee: document.evaluator,
    employeeDoc: document.employee,
    evaluatorDoc: document.evaluator,
    reason: `Rejected at ${levelData?.title || 'Current level'}`,
    comments,
    movementType: 'Transfer'
  });
};

const syncDocumentTracking = async ({ document, actorUser, holderEmployee, reason, comments }) => {
  await syncDocumentMaster({
    document,
    actorUser,
    holderEmployee,
    employeeDoc: document.employee,
    evaluatorDoc: document.evaluator,
    reason,
    comments
  });
};

module.exports = {
  logSend,
  logSubmission,
  logApproval,
  logRejection,
  syncDocumentTracking
};

