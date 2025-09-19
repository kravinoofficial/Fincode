const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Expense = require('../models/expense');
const { initializeAdmin } = require('../utils/adminSetup');

const router = express.Router();

/**
 * @swagger
 * /api/admin/delete-all-data:
 *   delete:
 *     summary: Delete all data from MongoDB (DANGEROUS - Use with extreme caution)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: All data deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 deletedCollections:
 *                   type: array
 *                   items:
 *                     type: string
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 */
router.delete('/admin/delete-all-data', async (req, res) => {
  try {
    console.log('⚠️  DELETE ALL DATA REQUEST RECEIVED - This will delete ALL data in the database!');
    
    // Get all collection names
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    
    console.log('Collections to be deleted:', collectionNames);
    
    // Delete all documents from all collections
    const deletionResults = [];
    
    for (const collectionName of collectionNames) {
      try {
        const result = await mongoose.connection.db.collection(collectionName).deleteMany({});
        deletionResults.push({
          collection: collectionName,
          deletedCount: result.deletedCount
        });
        console.log(`Deleted ${result.deletedCount} documents from ${collectionName}`);
      } catch (error) {
        console.error(`Error deleting from ${collectionName}:`, error);
        deletionResults.push({
          collection: collectionName,
          error: error.message
        });
      }
    }
    
    console.log('✅ All data deletion completed');
    
    res.json({
      success: true,
      message: 'All data has been deleted from the database',
      deletedCollections: collectionNames,
      deletionResults: deletionResults,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error during data deletion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete all data',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/admin/database-info:
 *   get:
 *     summary: Get database information and collection counts
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Database information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 collections:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       count:
 *                         type: number
 *                       sizeBytes:
 *                         type: number
 *                       storageSizeBytes:
 *                         type: number
 *                       totalIndexSizeBytes:
 *                         type: number
 *                 totalCollections:
 *                   type: number
 *                 storage:
 *                   type: object
 *                   properties:
 *                     fsTotalSize:
 *                       type: number
 *                       description: Total filesystem size in MB for the MongoDB data path
 *                     fsUsedSize:
 *                       type: number
 *                       description: Used filesystem size in MB for the MongoDB data path
 *                     fsAvailableSize:
 *                       type: number
 *                       description: Available filesystem size in MB (fsTotalSize - fsUsedSize)
 *                     dataSize:
 *                       type: number
 *                       description: Uncompressed data size in MB
 *                     storageSize:
 *                       type: number
 *                       description: Allocated storage size in MB (includes padding/overhead)
 *                     indexSize:
 *                       type: number
 *                       description: Total index size in MB
 *                     wiredTigerCache:
 *                       type: object
 *                       properties:
 *                         maxBytes:
 *                           type: number
 *                         usedBytes:
 *                           type: number
 *                         usedPercent:
 *                           type: number
 *                 load:
 *                   type: object
 *                   properties:
 *                     connections:
 *                       type: object
 *                       properties:
 *                         current:
 *                           type: number
 *                         available:
 *                           type: number
 *                         totalCreated:
 *                           type: number
 *                     networkMB:
 *                       type: object
 *                       properties:
 *                         bytesInMB:
 *                           type: number
 *                         bytesOutMB:
 *                           type: number
 *                         numRequests:
 *                           type: number
 *                     opcounters:
 *                       type: object
 *                       additionalProperties:
 *                         type: number
 *                     memoryMB:
 *                       type: object
 *                       properties:
 *                         residentMB:
 *                           type: number
 *                         virtualMB:
 *                           type: number
 *                 dbStatsMB:
 *                   type: object
 *                   properties:
 *                     dbName:
 *                       type: string
 *                     collections:
 *                       type: number
 *                     objects:
 *                       type: number
 *                     dataSizeMB:
 *                       type: number
 *                     storageSizeMB:
 *                       type: number
 *                     indexSizeMB:
 *                       type: number
 *                     avgObjSizeMB:
 *                       type: number
 */
router.get('/admin/database-info', async (req, res) => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionInfo = [];
    
    for (const collection of collections) {
      const coll = mongoose.connection.db.collection(collection.name);
      const count = await coll.countDocuments();
      let stats = {};
      try {
        stats = await coll.stats();
      } catch (_) {
        stats = {};
      }
      const sizeBytes = Number(stats.size || 0);
      const storageSizeBytes = Number(stats.storageSize || 0);
      const totalIndexSizeBytes = typeof stats.totalIndexSize === 'number'
        ? Number(stats.totalIndexSize)
        : (stats.indexSizes ? Object.values(stats.indexSizes).reduce((a, b) => a + Number(b || 0), 0) : 0);

      collectionInfo.push({
        name: collection.name,
        count,
        sizeBytes,
        storageSizeBytes,
        totalIndexSizeBytes
      });
    }
    // Gather database statistics
    let dbStats = {};
    let storage = {};
    let load = {};
    const toMB = v => Math.round((Number(v || 0) / (1024 * 1024)) * 100) / 100;
    try {
      dbStats = await mongoose.connection.db.stats();
      // Basic storage stats from db.stats()
      const fsTotalSize = Number(dbStats.fsTotalSize || 0);
      const fsUsedSize = Number(dbStats.fsUsedSize || 0);
      const fsAvailableSize = fsTotalSize && fsUsedSize ? (fsTotalSize - fsUsedSize) : undefined;

      storage = {
        fsTotalSize: toMB(fsTotalSize),
        fsUsedSize: toMB(fsUsedSize),
        fsAvailableSize: typeof fsAvailableSize === 'number' ? toMB(fsAvailableSize) : null,
        dataSize: toMB(dbStats.dataSize || 0),
        storageSize: toMB(dbStats.storageSize || 0),
        indexSize: toMB(dbStats.indexSize || 0)
      };

      // Try to include WiredTiger cache usage if available
      try {
        const serverStatus = await mongoose.connection.db.admin().serverStatus();
        const wt = serverStatus.wiredTiger?.cache;
        if (wt) {
          const maxBytes = Number(wt['maximum bytes configured'] || 0);
          const usedBytes = Number(wt['bytes currently in the cache'] || 0);
          storage.wiredTigerCache = {
            maxBytes: toMB(maxBytes),
            usedBytes: toMB(usedBytes),
            usedPercent: maxBytes > 0 ? Math.round((usedBytes / maxBytes) * 10000) / 100 : null
          };
        }

        // Load metrics
        load = {
          connections: {
            current: serverStatus.connections?.current ?? null,
            available: serverStatus.connections?.available ?? null,
            totalCreated: serverStatus.connections?.totalCreated ?? null
          },
          networkMB: {
            bytesInMB: toMB(serverStatus.network?.bytesIn || 0),
            bytesOutMB: toMB(serverStatus.network?.bytesOut || 0),
            numRequests: serverStatus.network?.numRequests ?? null
          },
          opcounters: serverStatus.opcounters || {},
          memoryMB: {
            residentMB: serverStatus.mem ? Number(serverStatus.mem.resident) : null,
            virtualMB: serverStatus.mem ? Number(serverStatus.mem.virtual) : null
          }
        };
      } catch (_) {
        // serverStatus not available or different storage engine; ignore
      }
    } catch (_) {
      // db.stats() failed (permissions or env), leave storage blank
    }

    const dbStatsMB = dbStats && dbStats.db ? {
      dbName: dbStats.db,
      collections: dbStats.collections,
      objects: dbStats.objects,
      dataSizeMB: toMB(dbStats.dataSize || 0),
      storageSizeMB: toMB(dbStats.storageSize || 0),
      indexSizeMB: toMB(dbStats.indexSize || 0),
      avgObjSizeMB: toMB(dbStats.avgObjSize || 0)
    } : {};

    res.json({
      success: true,
      collections: collectionInfo,
      totalCollections: collections.length,
      storage,
      load,
      dbStatsMB
    });
    
  } catch (error) {
    console.error('Error getting database info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get database information',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/admin/seed-admin:
 *   post:
 *     summary: Seed admin user and check existing admin details
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Admin seeding completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 adminExists:
 *                   type: boolean
 *                 adminDetails:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     number:
 *                       type: string
 *                     role:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *       500:
 *         description: Server error
 */
router.post('/admin/seed-admin', async (req, res) => {
  try {
    console.log('🔧 Admin seeding request received');
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    
    if (existingAdmin) {
      console.log('✅ Admin user already exists:', existingAdmin.name);
      
      res.json({
        success: true,
        message: 'Admin user already exists in database',
        adminExists: true,
        adminDetails: {
          _id: existingAdmin._id,
          name: existingAdmin.name,
          number: existingAdmin.number,
          address: existingAdmin.address,
          role: existingAdmin.role,
          monthlyAmount: existingAdmin.monthlyAmount,
          createdAt: existingAdmin._id.getTimestamp(),
          totalPayments: existingAdmin.payments ? existingAdmin.payments.length : 0,
          totalLoans: existingAdmin.loans ? existingAdmin.loans.length : 0
        }
      });
    } else {
      console.log('⚠️  No admin user found, creating new admin...');
      
      // Create new admin user
      const newAdmin = new User({
        name: 'Admin',
        number: '1234567890',
        address: 'Admin Address',
        monthlyAmount: 0,
        role: 'admin',
        numberpass: 'admin123',
        payments: [],
        loans: []
      });

      // Validate phone number format
      if (!/^\d{10}$/.test(newAdmin.number)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid phone number format for admin user',
          adminExists: false
        });
      }

      await newAdmin.save();
      console.log('✅ New admin user created successfully');

      res.json({
        success: true,
        message: 'New admin user created successfully',
        adminExists: false,
        adminDetails: {
          _id: newAdmin._id,
          name: newAdmin.name,
          number: newAdmin.number,
          address: newAdmin.address,
          role: newAdmin.role,
          monthlyAmount: newAdmin.monthlyAmount,
          createdAt: newAdmin._id.getTimestamp(),
          totalPayments: 0,
          totalLoans: 0
        },
        credentials: {
          username: newAdmin.number,
          password: newAdmin.numberpass
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error during admin seeding:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed admin user',
      error: error.message,
      adminExists: false
    });
  }
});

/**
 * @swagger
 * /api/admin/check-admin:
 *   get:
 *     summary: Check if admin user exists and get admin details
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Admin check completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 adminExists:
 *                   type: boolean
 *                 adminDetails:
 *                   type: object
 *                 totalAdmins:
 *                   type: number
 */
router.get('/admin/check-admin', async (req, res) => {
  try {
    console.log('🔍 Checking admin user existence...');
    
    // Find all admin users
    const adminUsers = await User.find({ role: 'admin' });
    const totalAdmins = adminUsers.length;
    
    if (totalAdmins > 0) {
      const primaryAdmin = adminUsers[0]; // Get first admin
      
      res.json({
        success: true,
        adminExists: true,
        totalAdmins: totalAdmins,
        adminDetails: {
          _id: primaryAdmin._id,
          name: primaryAdmin.name,
          number: primaryAdmin.number,
          address: primaryAdmin.address,
          role: primaryAdmin.role,
          monthlyAmount: primaryAdmin.monthlyAmount,
          createdAt: primaryAdmin._id.getTimestamp(),
          totalPayments: primaryAdmin.payments ? primaryAdmin.payments.length : 0,
          totalLoans: primaryAdmin.loans ? primaryAdmin.loans.length : 0
        },
        allAdmins: adminUsers.map(admin => ({
          _id: admin._id,
          name: admin.name,
          number: admin.number,
          role: admin.role
        }))
      });
    } else {
      res.json({
        success: true,
        adminExists: false,
        totalAdmins: 0,
        message: 'No admin users found in database'
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check admin user',
      error: error.message
    });
  }
});

module.exports = router;
