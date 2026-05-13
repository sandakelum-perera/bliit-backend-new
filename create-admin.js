// Script to create or update an admin user for testing
// Run this with: node create-admin.js

const mongoose = require("mongoose");
const User = require("./models/User");

// MongoDB connection string - update with your credentials
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/brightlens";

async function createAdminUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    // Admin user details - modify as needed
    const adminEmail = "admin@brightlens.com";
    const adminData = {
      name: "Admin User",
      email: adminEmail,
      role: "admin",
      type: "admin",
      password: "admin123", // Change this in production!
      email_verified_at: new Date(),
    };

    // Check if admin user exists
    let admin = await User.findOne({ email: adminEmail });

    if (admin) {
      // Update existing user to admin role
      admin.role = "admin";
      admin.type = "admin";
      await admin.save();
      console.log(`✓ Updated existing user ${adminEmail} to admin role`);
    } else {
      // Create new admin user
      admin = new User(adminData);
      await admin.save();
      console.log(`✓ Created new admin user: ${adminEmail}`);
    }

    console.log("\nAdmin user details:");
    console.log(`Email: ${admin.email}`);
    console.log(`Role: ${admin.role}`);
    console.log(`ID: ${admin._id}`);
    console.log("\nYou can now login at /admin with these credentials");

    process.exit(0);
  } catch (error) {
    console.error("Error creating admin user:", error);
    process.exit(1);
  }
}

createAdminUser();
