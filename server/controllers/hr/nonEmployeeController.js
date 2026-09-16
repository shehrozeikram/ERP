const NonEmployeeRecord = require('../../models/hr/NonEmployeeRecord');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

exports.createRecord = async (req, res) => {
  try {
    const { employees, assignedHod, assignedAvp, assignedChairman } = req.body;
    
    // Support legacy client sending a stringified employees array in FormData
    let parsedEmployees = employees;
    if (typeof employees === 'string') {
      try {
        parsedEmployees = JSON.parse(employees);
      } catch (e) {
        parsedEmployees = [];
      }
    }

    const autoSignature = req.body.requesterSignature || (req.user.firstName ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : req.user.email);

    const record = new NonEmployeeRecord({
      employees: parsedEmployees || [],
      requesterSignature: autoSignature,
      assignedHod,
      assignedAvp,
      assignedChairman,
      workflowStatus: 'Pending HOD HR',
      initiator: req.user.id,
    });

    if (req.files && req.files.length > 0) {
      record.attachments = req.files.map(f => ({
        filename: f.filename,
        originalName: f.originalname,
        url: f.path,
      }));
    }

    await record.save();

    res.status(201).json({ success: true, data: record });
  } catch (error) {
    console.error('Error creating NonEmployeeRecord:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

exports.updateRecord = async (req, res) => {
  try {
    let record = await NonEmployeeRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }
    
    // Allow updating only if not fully approved or if returned, unless it's the developer
    const isDeveloper = req.user.email === 'developer@tovus.net';
    if (!isDeveloper && (record.workflowStatus === 'Approved by CEO' || record.workflowStatus === 'Rejected by CEO')) {
      return res.status(400).json({ success: false, error: 'Cannot update a completed record' });
    }

    const { employees, assignedHod, assignedAvp, assignedChairman } = req.body;
    
    let parsedEmployees = employees;
    if (typeof employees === 'string') {
      try {
        parsedEmployees = JSON.parse(employees);
      } catch (e) {
        parsedEmployees = record.employees;
      }
    }

    if (parsedEmployees) record.employees = parsedEmployees;
    if (assignedHod) record.assignedHod = assignedHod;
    if (assignedAvp) record.assignedAvp = assignedAvp;
    if (assignedChairman) record.assignedChairman = assignedChairman;

    // Reset status to pending HOD if it was returned and updated by initiator
    if (record.workflowStatus === 'Returned') {
       record.workflowStatus = 'Pending HOD HR';
    }

    await record.save();
    res.status(200).json({ success: true, data: record });
  } catch (error) {
    console.error('Error updating NonEmployeeRecord:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

exports.deleteRecord = async (req, res) => {
  try {
    const record = await NonEmployeeRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }
    
    if (record.workflowStatus !== 'Pending HOD HR' && record.workflowStatus !== 'Draft' && record.workflowStatus !== 'Returned') {
       return res.status(400).json({ success: false, error: 'Only pending or returned records can be deleted' });
    }

    await record.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    console.error('Error deleting NonEmployeeRecord:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

exports.getRecords = async (req, res) => {
  try {
    const records = await NonEmployeeRecord.find()
      .populate('initiator', 'firstName lastName email')
      .populate('assignedHod', 'firstName lastName email')
      .populate('assignedAvp', 'firstName lastName email')
      .populate('assignedChairman', 'firstName lastName email')
      .populate('hodApprovedBy', 'firstName lastName email')
      .populate('avpApprovedBy', 'firstName lastName email')
      .populate('chairmanApprovedBy', 'firstName lastName email')
      .populate('ceoApprovedBy', 'firstName lastName email')
      .sort('-createdAt');
    res.status(200).json({ success: true, count: records.length, data: records });
  } catch (error) {
    console.error('Error fetching NonEmployeeRecords:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

exports.getRecordById = async (req, res) => {
  try {
    const record = await NonEmployeeRecord.findById(req.params.id)
      .populate('initiator', 'firstName lastName email')
      .populate('assignedHod', 'firstName lastName email')
      .populate('assignedAvp', 'firstName lastName email')
      .populate('assignedChairman', 'firstName lastName email')
      .populate('hodApprovedBy', 'firstName lastName email')
      .populate('avpApprovedBy', 'firstName lastName email')
      .populate('chairmanApprovedBy', 'firstName lastName email')
      .populate('ceoApprovedBy', 'firstName lastName email');
      
    if (!record) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }
    res.status(200).json({ success: true, data: record });
  } catch (error) {
    console.error('Error fetching NonEmployeeRecord:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

exports.approveByHOD = async (req, res) => {
  try {
    const record = await NonEmployeeRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    if (record.workflowStatus !== 'Pending HOD HR') {
      return res.status(400).json({ success: false, error: `Invalid status: ${record.workflowStatus}` });
    }

    if (record.assignedHod) {
      const assignedId = record.assignedHod._id ? record.assignedHod._id.toString() : record.assignedHod.toString();
      if (assignedId !== req.user.id) {
        return res.status(403).json({ success: false, error: 'You are not the assigned HOD for this record' });
      }
    }

    record.workflowStatus = 'Pending AVP';
    record.hodApprovedBy = req.user.id;
    record.hodApprovedAt = Date.now();
    record.hodComments = req.body.comments || '';
    record.hodSignature = req.body.signature || (req.user.firstName ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : req.user.email);

    await record.save();
    res.status(200).json({ success: true, data: record });
  } catch (error) {
    console.error('Error in HOD approval:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

exports.rejectByHOD = async (req, res) => {
  try {
    const record = await NonEmployeeRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    if (record.workflowStatus !== 'Pending HOD HR') {
      return res.status(400).json({ success: false, error: `Invalid status: ${record.workflowStatus}` });
    }

    if (record.assignedHod) {
      const assignedId = record.assignedHod._id ? record.assignedHod._id.toString() : record.assignedHod.toString();
      if (assignedId !== req.user.id) {
        return res.status(403).json({ success: false, error: 'You are not the assigned HOD for this record' });
      }
    }

    record.workflowStatus = 'Returned';
    record.hodApprovedBy = req.user.id;
    record.hodApprovedAt = Date.now();
    record.hodComments = req.body.comments || '';
    record.hodSignature = req.body.signature || (req.user.firstName ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : req.user.email);

    await record.save();
    res.status(200).json({ success: true, data: record });
  } catch (error) {
    console.error('Error in HOD rejection:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

exports.approveByAVP = async (req, res) => {
  try {
    const record = await NonEmployeeRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    if (record.workflowStatus !== 'Pending AVP') {
      return res.status(400).json({ success: false, error: `Invalid status: ${record.workflowStatus}` });
    }

    if (record.assignedAvp) {
      const assignedId = record.assignedAvp._id ? record.assignedAvp._id.toString() : record.assignedAvp.toString();
      if (assignedId !== req.user.id) {
        return res.status(403).json({ success: false, error: 'You are not the assigned AVP for this record' });
      }
    }

    record.workflowStatus = 'Pending Chairman';
    record.avpApprovedBy = req.user.id;
    record.avpApprovedAt = Date.now();
    record.avpComments = req.body.comments || '';
    record.avpSignature = req.body.signature || (req.user.firstName ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : req.user.email);

    await record.save();
    res.status(200).json({ success: true, data: record });
  } catch (error) {
    console.error('Error in AVP approval:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

exports.rejectByAVP = async (req, res) => {
  try {
    const record = await NonEmployeeRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    if (record.workflowStatus !== 'Pending AVP') {
      return res.status(400).json({ success: false, error: `Invalid status: ${record.workflowStatus}` });
    }

    if (record.assignedAvp) {
      const assignedId = record.assignedAvp._id ? record.assignedAvp._id.toString() : record.assignedAvp.toString();
      if (assignedId !== req.user.id) {
        return res.status(403).json({ success: false, error: 'You are not the assigned AVP for this record' });
      }
    }

    record.workflowStatus = 'Returned';
    record.avpApprovedBy = req.user.id;
    record.avpApprovedAt = Date.now();
    record.avpComments = req.body.comments || '';
    record.avpSignature = req.body.signature || (req.user.firstName ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : req.user.email);

    await record.save();
    res.status(200).json({ success: true, data: record });
  } catch (error) {
    console.error('Error in AVP rejection:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

exports.approveByChairman = async (req, res) => {
  try {
    const record = await NonEmployeeRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    if (record.workflowStatus !== 'Pending Chairman') {
      return res.status(400).json({ success: false, error: `Invalid status: ${record.workflowStatus}` });
    }

    if (record.assignedChairman) {
      const assignedId = record.assignedChairman._id ? record.assignedChairman._id.toString() : record.assignedChairman.toString();
      if (assignedId !== req.user.id) {
        return res.status(403).json({ success: false, error: 'You are not the assigned Chairman for this record' });
      }
    }

    record.workflowStatus = 'Forwarded to CEO';
    record.chairmanApprovedBy = req.user.id;
    record.chairmanApprovedAt = Date.now();
    record.chairmanComments = req.body.comments || '';
    record.chairmanSignature = req.body.signature || (req.user.firstName ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : req.user.email);

    await record.save();
    res.status(200).json({ success: true, data: record });
  } catch (error) {
    console.error('Error in Chairman approval:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

exports.rejectByChairman = async (req, res) => {
  try {
    const record = await NonEmployeeRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    if (record.workflowStatus !== 'Pending Chairman') {
      return res.status(400).json({ success: false, error: `Invalid status: ${record.workflowStatus}` });
    }

    if (record.assignedChairman) {
      const assignedId = record.assignedChairman._id ? record.assignedChairman._id.toString() : record.assignedChairman.toString();
      if (assignedId !== req.user.id) {
        return res.status(403).json({ success: false, error: 'You are not the assigned Chairman for this record' });
      }
    }

    record.workflowStatus = 'Returned';
    record.chairmanApprovedBy = req.user.id;
    record.chairmanApprovedAt = Date.now();
    record.chairmanComments = req.body.comments || '';
    record.chairmanSignature = req.body.signature || (req.user.firstName ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : req.user.email);

    await record.save();
    res.status(200).json({ success: true, data: record });
  } catch (error) {
    console.error('Error in Chairman rejection:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// CEO Endpoints
exports.getForCEO = async (req, res) => {
  try {
    const records = await NonEmployeeRecord.find({ workflowStatus: 'Forwarded to CEO' })
      .populate('initiator', 'firstName lastName email')
      .populate('hodApprovedBy', 'firstName lastName email')
      .sort('-createdAt');
    res.status(200).json({ success: true, count: records.length, data: records });
  } catch (error) {
    console.error('Error fetching CEO NonEmployeeRecords:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

exports.approveByCEO = async (req, res) => {
  try {
    const record = await NonEmployeeRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    record.workflowStatus = 'Approved by CEO';
    record.ceoApprovedBy = req.user.id;
    record.ceoApprovedAt = Date.now();
    record.ceoComments = req.body.comments || '';
    record.ceoSignature = req.body.signature || (req.user.firstName ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : req.user.email);

    await record.save();
    res.status(200).json({ success: true, data: record });
  } catch (error) {
    console.error('Error in CEO approval:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

exports.rejectByCEO = async (req, res) => {
  try {
    const record = await NonEmployeeRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    record.workflowStatus = 'Rejected by CEO';
    record.ceoApprovedBy = req.user.id;
    record.ceoApprovedAt = Date.now();
    record.rejectionComments = req.body.comments || '';
    record.ceoSignature = req.body.signature || (req.user.firstName ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : req.user.email);

    await record.save();
    res.status(200).json({ success: true, data: record });
  } catch (error) {
    console.error('Error in CEO rejection:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

exports.returnByCEO = async (req, res) => {
  try {
    const record = await NonEmployeeRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    record.workflowStatus = 'Returned';
    record.returnComments = req.body.comments || '';

    await record.save();
    res.status(200).json({ success: true, data: record });
  } catch (error) {
    console.error('Error in CEO return:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};
