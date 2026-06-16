const express = require('express');
const path = require('path');
const XLSX = require('xlsx');
const permissions = require('../middleware/permissions');
const HouseInventoryItem = require('../models/hr/HouseInventoryItem');
const HouseInventoryHouse = require('../models/hr/HouseInventoryHouse');

const router = express.Router();

const HOUSE_INVENTORY_PERMISSION = permissions.checkSubRolePermission('admin', 'house_inventory', 'read');
const HOUSE_INVENTORY_CREATE_PERMISSION = permissions.checkSubRolePermission('admin', 'house_inventory', 'create');
const HOUSE_INVENTORY_UPDATE_PERMISSION = permissions.checkSubRolePermission('admin', 'house_inventory', 'update');
const HOUSE_INVENTORY_DELETE_PERMISSION = permissions.checkSubRolePermission('admin', 'house_inventory', 'delete');

const parseExcelDate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    try {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (!parsed) return null;
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    } catch {
      return null;
    }
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseQuantity = (rawQty) => {
  const quantityText = String(rawQty || '').trim();
  if (!quantityText) return { quantityText: '', quantityValue: null, quantityUnit: '' };
  const match = quantityText.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!match) return { quantityText, quantityValue: null, quantityUnit: '' };
  return {
    quantityText,
    quantityValue: Number(match[1]),
    quantityUnit: String(match[2] || '').trim()
  };
};

const isHeaderRow = (row) => {
  const first = String(row[0] || '').toLowerCase().replace(/\s+/g, '');
  const second = String(row[1] || '').toLowerCase().replace(/\s+/g, '');
  const third = String(row[2] || '').toLowerCase().replace(/\s+/g, '');
  return first.includes('sr') && second.includes('date') && third.includes('description');
};

const isInventoryDataRow = (row) => {
  const serial = row[0];
  const description = String(row[2] || '').trim();
  return description && Number.isFinite(Number(serial)) && Number(serial) > 0;
};

const extractSectionAreaName = (row) => {
  if (isHeaderRow(row) || isInventoryDataRow(row)) return null;

  const first = String(row[0] || '').trim();
  const second = String(row[1] || '').trim();
  const third = String(row[2] || '').trim();
  const fourth = String(row[3] || '').trim();

  if (fourth) return null;

  if (first && !second && !third) return first;
  if (!first && !second && third) return third;

  return null;
};

const importWorkbookRows = (filePath, userId) => {
  const workbook = XLSX.readFile(filePath);
  const now = new Date();
  const rows = [];

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    if (!data.length) return;

    let houseName = String(data[0]?.[0] || sheetName).trim();
    let areaName = 'General';

    for (let i = 1; i < data.length; i += 1) {
      const row = data[i];
      const rawFirst = row[0];
      const rawSecond = row[1];
      const rawThird = row[2];
      const rawFourth = row[3];

      const first = String(rawFirst || '').trim();
      const second = String(rawSecond || '').trim();
      const third = String(rawThird || '').trim();
      const fourth = String(rawFourth || '').trim();

      if (!first && !second && !third && !fourth) continue;
      if (isHeaderRow(row)) continue;

      const sectionArea = extractSectionAreaName(row);
      if (sectionArea) {
        areaName = sectionArea;
        continue;
      }

      if (!isInventoryDataRow(row)) continue;

      const dateVal = now;
      const description = third;

      const qty = parseQuantity(fourth);
      rows.push({
        houseName,
        areaName,
        inventoryDate: dateVal,
        description,
        quantityText: qty.quantityText,
        quantityValue: qty.quantityValue,
        quantityUnit: qty.quantityUnit,
        sourceSheet: sheetName,
        sourceRow: i + 1,
        importedFromWorkbook: true,
        createdBy: userId,
        updatedBy: userId,
        createdAt: now,
        updatedAt: now
      });
    }
  });

  return rows;
};

// Ensure SR No (`serialNo`) is unique per house and sequential starting from 1.
// We intentionally ignore `areaName` here, so each house has its own 1..N sequence.
const normalizeHouseInventorySerials = async (houseName) => {
  if (!houseName) return;

  const items = await HouseInventoryItem.find({ houseName })
    .sort({ createdAt: 1, sourceSheet: 1, sourceRow: 1, serialNo: 1, _id: 1 })
    .lean();

  await Promise.all(
    items.map((item, index) => HouseInventoryItem.updateOne(
      { _id: item._id },
      { $set: { serialNo: index + 1 } }
    ))
  );
};

// GET /api/house-inventory/houses
router.get('/houses', HOUSE_INVENTORY_PERMISSION, async (req, res) => {
  try {
    const [houseMasters, summary] = await Promise.all([
      HouseInventoryHouse.find({}).sort({ name: 1 }).lean(),
      HouseInventoryItem.aggregate([
      {
        $group: {
          _id: { houseName: '$houseName', areaName: '$areaName' },
          itemCount: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.houseName',
          itemCount: { $sum: '$itemCount' },
          areas: {
            $push: {
              name: '$_id.areaName',
              itemCount: '$itemCount'
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ])
    ]);

    const summaryMap = new Map(summary.map((entry) => [entry._id, entry]));
    const merged = houseMasters.map((house) => {
      const stats = summaryMap.get(house.name);
      return {
        _id: house._id,
        houseName: house.name,
        notes: house.notes || '',
        itemCount: stats?.itemCount || 0,
        areas: (stats?.areas || []).sort((a, b) => a.name.localeCompare(b.name))
      };
    });

    res.json({
      success: true,
      data: merged
    });
  } catch (error) {
    console.error('Error fetching house inventory houses:', error);
    res.status(500).json({ success: false, message: 'Error fetching houses' });
  }
});

// POST /api/house-inventory/houses
router.post('/houses', HOUSE_INVENTORY_CREATE_PERMISSION, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const notes = String(req.body.notes || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'House name is required' });

    const existing = await HouseInventoryHouse.findOne({ name });
    if (existing) return res.status(400).json({ success: false, message: 'House already exists' });

    const house = await HouseInventoryHouse.create({
      name,
      notes,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    return res.status(201).json({ success: true, data: house, message: 'House added successfully' });
  } catch (error) {
    console.error('Error creating house master:', error);
    return res.status(500).json({ success: false, message: 'Failed to create house' });
  }
});

// GET /api/house-inventory
router.get('/', HOUSE_INVENTORY_PERMISSION, async (req, res) => {
  try {
    const { houseName, areaName, search = '', page = 1, limit = 200 } = req.query;
    const filter = {};
    if (houseName) filter.houseName = houseName;
    if (areaName) filter.areaName = areaName;
    if (search) {
      filter.$or = [
        { description: { $regex: search, $options: 'i' } },
        { quantityText: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    if (houseName) {
      // Keep SR No correct for existing data too.
      await normalizeHouseInventorySerials(String(houseName));
    }

    const [items, total, summaryRows] = await Promise.all([
      HouseInventoryItem.find(filter)
        .sort({ serialNo: 1, description: 1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      HouseInventoryItem.countDocuments(filter),
      HouseInventoryItem.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalQuantity: { $sum: { $ifNull: ['$quantityValue', 0] } },
            itemsWithQuantity: {
              $sum: {
                $cond: [{ $ne: [{ $ifNull: ['$quantityValue', null] }, null] }, 1, 0]
              }
            },
            areas: { $addToSet: '$areaName' }
          }
        },
        {
          $project: {
            _id: 0,
            totalQuantity: 1,
            itemsWithQuantity: 1,
            areaCount: { $size: '$areas' }
          }
        }
      ])
    ]);

    const summary = summaryRows[0] || {
      totalQuantity: 0,
      itemsWithQuantity: 0,
      areaCount: 0
    };

    res.json({
      success: true,
      data: items,
      summary: {
        totalItems: total,
        totalQuantity: summary.totalQuantity || 0,
        itemsWithQuantity: summary.itemsWithQuantity || 0,
        areaCount: summary.areaCount || 0
      },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)) || 1
      }
    });
  } catch (error) {
    console.error('Error fetching house inventory:', error);
    res.status(500).json({ success: false, message: 'Error fetching house inventory' });
  }
});

// POST /api/house-inventory/import-from-docs
router.post('/import-from-docs', HOUSE_INVENTORY_CREATE_PERMISSION, async (req, res) => {
  try {
    const workbookPath = path.resolve(__dirname, '../../docs/Houses Inventory.xlsx');
    const rows = importWorkbookRows(workbookPath, req.user._id);

    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'No inventory rows found in workbook' });
    }

    await HouseInventoryItem.deleteMany({});
    const houseNames = [...new Set(rows.map((r) => r.houseName).filter(Boolean))];
    await HouseInventoryHouse.deleteMany({});
    if (houseNames.length) {
      await HouseInventoryHouse.insertMany(
        houseNames.map((name) => ({
          name,
          createdBy: req.user._id,
          updatedBy: req.user._id
        }))
      );
    }
    await HouseInventoryItem.insertMany(rows);

    // Renumber SR No per house (1..N) after import.
    await Promise.all(houseNames.map((name) => normalizeHouseInventorySerials(name)));

    return res.json({
      success: true,
      message: 'House inventory imported successfully',
      data: { importedCount: rows.length }
    });
  } catch (error) {
    console.error('Error importing house inventory workbook:', error);
    return res.status(500).json({ success: false, message: 'Failed to import workbook data' });
  }
});

// POST /api/house-inventory
router.post('/', HOUSE_INVENTORY_CREATE_PERMISSION, async (req, res) => {
  try {
    const houseName = String(req.body.houseName || '').trim();
    const areaName = String(req.body.areaName || '').trim();
    const description = String(req.body.description || '').trim();

    if (!houseName || !areaName || !description) {
      return res.status(400).json({ success: false, message: 'House, area, and description are required' });
    }

    const house = await HouseInventoryHouse.findOne({ name: houseName }).lean();
    if (!house) return res.status(400).json({ success: false, message: 'Selected house does not exist' });

    const lastInArea = await HouseInventoryItem.findOne({ houseName, areaName })
      .sort({ serialNo: -1, createdAt: -1 })
      .lean();
    const nextSerialNo = Number.isFinite(Number(lastInArea?.serialNo))
      ? Number(lastInArea.serialNo) + 1
      : 1;

    const payload = {
      houseName,
      areaName,
      serialNo: nextSerialNo,
      inventoryDate: parseExcelDate(req.body.inventoryDate),
      description,
      quantityText: String(req.body.quantityText || '').trim(),
      quantityValue: Number.isFinite(Number(req.body.quantityValue)) ? Number(req.body.quantityValue) : null,
      quantityUnit: String(req.body.quantityUnit || '').trim(),
      notes: String(req.body.notes || '').trim(),
      importedFromWorkbook: false,
      createdBy: req.user._id,
      updatedBy: req.user._id
    };

    const item = await HouseInventoryItem.create(payload);
    await normalizeHouseInventorySerials(houseName);
    const normalizedItem = await HouseInventoryItem.findById(item._id).lean();

    return res.status(201).json({ success: true, data: normalizedItem, message: 'Inventory item created successfully' });
  } catch (error) {
    console.error('Error creating house inventory item:', error);
    return res.status(500).json({ success: false, message: 'Failed to create inventory item' });
  }
});

// PUT /api/house-inventory/:id
router.put('/:id', HOUSE_INVENTORY_UPDATE_PERMISSION, async (req, res) => {
  try {
    const houseName = String(req.body.houseName || '').trim();
    const areaName = String(req.body.areaName || '').trim();
    const description = String(req.body.description || '').trim();

    if (!houseName || !areaName || !description) {
      return res.status(400).json({ success: false, message: 'House, area, and description are required' });
    }

    const house = await HouseInventoryHouse.findOne({ name: houseName }).lean();
    if (!house) return res.status(400).json({ success: false, message: 'Selected house does not exist' });

    const existing = await HouseInventoryItem.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ success: false, message: 'Inventory item not found' });

    const payload = {
      houseName,
      areaName,
      serialNo: Number.isFinite(Number(existing.serialNo)) ? Number(existing.serialNo) : 1,
      inventoryDate: parseExcelDate(req.body.inventoryDate),
      description,
      quantityText: String(req.body.quantityText || '').trim(),
      quantityValue: Number.isFinite(Number(req.body.quantityValue)) ? Number(req.body.quantityValue) : null,
      quantityUnit: String(req.body.quantityUnit || '').trim(),
      notes: String(req.body.notes || '').trim(),
      updatedBy: req.user._id
    };

    await HouseInventoryItem.findByIdAndUpdate(req.params.id, payload, { new: true });
    await normalizeHouseInventorySerials(houseName);
    const normalizedItem = await HouseInventoryItem.findById(req.params.id).lean();

    return res.json({ success: true, data: normalizedItem, message: 'Inventory item updated successfully' });
  } catch (error) {
    console.error('Error updating house inventory item:', error);
    return res.status(500).json({ success: false, message: 'Failed to update inventory item' });
  }
});

// DELETE /api/house-inventory/:id
router.delete('/:id', HOUSE_INVENTORY_DELETE_PERMISSION, async (req, res) => {
  try {
    const item = await HouseInventoryItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Inventory item not found' });

    await normalizeHouseInventorySerials(item.houseName);
    return res.json({ success: true, message: 'Inventory item deleted successfully' });
  } catch (error) {
    console.error('Error deleting house inventory item:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete inventory item' });
  }
});

module.exports = router;
