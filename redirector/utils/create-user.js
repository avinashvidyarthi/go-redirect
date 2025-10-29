#!/usr/bin/env node

const mongoose = require('mongoose');
const inquirer = require('inquirer');
const User = require('../models/User');
const logger = require('./logger');

const MONGODB_URI = process.env.MONGODB_URI;

// Connect to MongoDB
async function connectDB() {
    try {
        await mongoose.connect(MONGODB_URI);
        logger.info('User creation utility connected to MongoDB', { service: 'create-user' });
    } catch (error) {
        logger.error('MongoDB connection error', { service: 'create-user', error: error.message });
        process.exit(1);
    }
}

// Create user
async function createUser() {
    console.log('🔐 Create New User');

    const { name, email, password, confirmPassword, isActive } = await inquirer.prompt([
        {
            type: 'input',
            name: 'name',
            message: 'Enter full name:',
            validate: input => input.trim() ? true : 'Name cannot be empty'
        },
        {
            type: 'input',
            name: 'email',
            message: 'Enter email address:',
            validate: input => {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return emailRegex.test(input.trim()) ? true : 'Please enter a valid email address';
            }
        },
        {
            type: 'password',
            name: 'password',
            message: 'Enter password:',
            validate: input => input.length >= 6 ? true : 'Password must be at least 6 characters long'
        },
        {
            type: 'password',
            name: 'confirmPassword',
            message: 'Confirm password:',
            validate: (input, answers) => input === answers.password ? true : 'Passwords do not match'
        },
        {
            type: 'confirm',
            name: 'isActive',
            message: 'Activate user immediately?',
            default: true
        }
    ]);

    try {
        const user = new User({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password: password,
            isActive: isActive
        });

        await user.save();

        console.log(`✅ User created successfully!`);
        console.log(`   Name: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Status: ${user.isActive ? 'Active' : 'Inactive'}`);
        console.log(`   ID: ${user._id}`);

        logger.info('User created via utility', {
            action: 'create_user',
            userId: user._id,
            email: user.email,
            name: user.name,
            isActive: user.isActive,
            service: 'create-user'
        });

    } catch (error) {
        if (error.code === 11000) {
            console.log('❌ Error: Email already exists');
            logger.warn('User creation failed - duplicate email', {
                action: 'create_user',
                email: email.trim().toLowerCase(),
                error: 'Email already exists',
                service: 'create-user'
            });
        } else {
            console.log('❌ Error:', error.message);
            logger.error('User creation failed', {
                action: 'create_user',
                email: email.trim().toLowerCase(),
                error: error.message,
                service: 'create-user'
            });
        }
    }
}

// List existing users
async function listUsers() {
    try {
        const users = await User.find().select('name email isActive createdAt').sort({ createdAt: -1 });

        if (users.length === 0) {
            console.log('No users found');
            return;
        }

        console.log('\n👥 Existing Users:');
        users.forEach(user => {
            const status = user.isActive ? '🟢 Active' : '🔴 Inactive';
            console.log(`  ${user.name} (${user.email}) - ${status} - Created: ${user.createdAt.toLocaleDateString()}`);
        });
        console.log('');

    } catch (error) {
        console.log('❌ Error listing users:', error.message);
        logger.error('Error listing users', {
            action: 'list_users',
            error: error.message,
            service: 'create-user'
        });
    }
}

// Toggle user active status
async function toggleUserStatus() {
    try {
        const users = await User.find().select('name email isActive').sort({ name: 1 });

        if (users.length === 0) {
            console.log('No users found');
            return;
        }

        const { selectedUserId } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedUserId',
                message: 'Select user to toggle status:',
                choices: users.map(user => ({
                    name: `${user.name} (${user.email}) - ${user.isActive ? '🟢 Active' : '🔴 Inactive'}`,
                    value: user._id
                }))
            }
        ]);

        const user = await User.findById(selectedUserId);
        const newStatus = !user.isActive;

        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: `${newStatus ? 'Activate' : 'Deactivate'} user ${user.name}?`,
                default: true
            }
        ]);

        if (confirm) {
            user.isActive = newStatus;
            await user.save();

            console.log(`✅ User ${newStatus ? 'activated' : 'deactivated'}: ${user.name}`);

            logger.info('User status toggled via utility', {
                action: 'toggle_user_status',
                userId: user._id,
                email: user.email,
                name: user.name,
                newStatus: newStatus,
                service: 'create-user'
            });
        }

    } catch (error) {
        console.log('❌ Error toggling user status:', error.message);
        logger.error('Error toggling user status', {
            action: 'toggle_user_status',
            error: error.message,
            service: 'create-user'
        });
    }
}

// Main menu
async function mainMenu() {
    const { action } = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
                'Create new user',
                'List existing users',
                'Toggle user active status',
                'Exit'
            ]
        }
    ]);

    switch (action) {
        case 'Create new user':
            await createUser();
            break;
        case 'List existing users':
            await listUsers();
            break;
        case 'Toggle user active status':
            await toggleUserStatus();
            break;
        case 'Exit':
            console.log('Goodbye!');
            process.exit(0);
    }

    // Return to main menu
    await mainMenu();
}

// Start the utility
async function start() {
    console.log('🚀 Go Redirect - User Management Utility');
    logger.info('User creation utility started', { service: 'create-user' });
    await connectDB();
    await mainMenu();
}

start().catch(console.error);