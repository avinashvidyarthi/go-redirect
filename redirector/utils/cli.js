#!/usr/bin/env node

const mongoose = require('mongoose');
const inquirer = require('inquirer');
const Redirect = require('../models/Redirect');
const User = require('../models/User');
const logger = require('./logger');

const MONGODB_URI = process.env.MONGODB_URI;
let currentUser = null;

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('CLI connected to MongoDB', { service: 'cli' });
  } catch (error) {
    logger.error('CLI MongoDB connection error', { service: 'cli', error: error.message });
    process.exit(1);
  }
}

// User selection
async function selectUser() {
  const users = await User.find({ isActive: true }).select('name email isActive').sort({ name: 1 });
  
  if (users.length === 0) {
    console.log('❌ No active users found. Please create and activate a user first using: npm run create-user');
    process.exit(1);
  }

  const { selectedUserId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedUserId',
      message: 'Select active user:',
      choices: users.map(user => ({ 
        name: `${user.name} (${user.email})`, 
        value: user._id 
      }))
    }
  ]);

  currentUser = users.find(user => user._id.toString() === selectedUserId.toString());
  console.log(`✅ Working as: ${currentUser.name}\n`);
  
  logger.info('CLI user selected', {
    userId: currentUser._id,
    userName: currentUser.name,
    isActive: currentUser.isActive,
    service: 'cli'
  });
}

// Main menu
async function mainMenu() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        'Add new redirect',
        'Edit existing redirect',
        'Delete redirect',
        'List all redirects',
        'Exit'
      ]
    }
  ]);

  switch (action) {
    case 'Add new redirect':
      await addRedirect();
      break;
    case 'Edit existing redirect':
      await editRedirect();
      break;
    case 'Delete redirect':
      await deleteRedirect();
      break;
    case 'List all redirects':
      await listRedirects();
      break;
    case 'Exit':
      console.log('Goodbye!');
      process.exit(0);
  }

  // Return to main menu
  await mainMenu();
}

// Add new redirect
async function addRedirect() {
  const { slug, url } = await inquirer.prompt([
    {
      type: 'input',
      name: 'slug',
      message: 'Enter slug (e.g., netflix):',
      validate: input => input.trim() ? true : 'Slug cannot be empty'
    },
    {
      type: 'input',
      name: 'url',
      message: 'Enter URL (e.g., netflix.com):',
      validate: input => input.trim() ? true : 'URL cannot be empty'
    }
  ]);

  try {
    const redirect = new Redirect({ 
      slug: slug.trim().toLowerCase(), 
      url: url.trim(),
      userId: currentUser._id
    });
    await redirect.save();
    console.log(`✅ Redirect added: go/${slug} → ${url}`);
    logger.info('Redirect added via CLI', {
      action: 'add',
      slug: slug.trim().toLowerCase(),
      url: url.trim(),
      userId: currentUser._id,
      service: 'cli'
    });
  } catch (error) {
    if (error.code === 11000) {
      console.log('❌ Error: Slug already exists for this user');
      logger.warn('CLI add redirect failed - duplicate slug', {
        action: 'add',
        slug: slug.trim().toLowerCase(),
        userId: currentUser._id,
        error: 'Slug already exists',
        service: 'cli'
      });
    } else {
      console.log('❌ Error:', error.message);
      logger.error('CLI add redirect failed', {
        action: 'add',
        slug: slug.trim().toLowerCase(),
        userId: currentUser._id,
        error: error.message,
        service: 'cli'
      });
    }
  }
}// Edit existing redirect
async function editRedirect() {
  const redirects = await Redirect.find({ userId: currentUser._id }).sort({ slug: 1 });

  if (redirects.length === 0) {
    console.log('No redirects found for this user');
    return;
  }

  const { selectedSlug } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedSlug',
      message: 'Select redirect to edit:',
      choices: redirects.map(r => ({ name: `${r.slug} → ${r.url}`, value: r.slug }))
    }
  ]);

  const redirect = await Redirect.findOne({ slug: selectedSlug, userId: currentUser._id });

  const { newUrl } = await inquirer.prompt([
    {
      type: 'input',
      name: 'newUrl',
      message: 'Enter new URL:',
      default: redirect.url,
      validate: input => input.trim() ? true : 'URL cannot be empty'
    }
  ]);

  try {
    const oldUrl = redirect.url;
    redirect.url = newUrl.trim();
    await redirect.save();
    console.log(`✅ Redirect updated: go/${selectedSlug} → ${newUrl}`);
    logger.info('Redirect updated via CLI', {
      action: 'edit',
      slug: selectedSlug,
      oldUrl: oldUrl,
      newUrl: newUrl.trim(),
      userId: currentUser._id,
      service: 'cli'
    });
  } catch (error) {
    console.log('❌ Error:', error.message);
    logger.error('CLI edit redirect failed', {
      action: 'edit',
      slug: selectedSlug,
      userId: currentUser._id,
      error: error.message,
      service: 'cli'
    });
  }
}

// Delete redirect
async function deleteRedirect() {
  const redirects = await Redirect.find({ userId: currentUser._id }).sort({ slug: 1 });

  if (redirects.length === 0) {
    console.log('No redirects found for this user');
    return;
  }

  const { selectedSlug } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedSlug',
      message: 'Select redirect to delete:',
      choices: redirects.map(r => ({ name: `${r.slug} → ${r.url}`, value: r.slug }))
    }
  ]);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete go/${selectedSlug}?`,
      default: false
    }
  ]);

  if (confirm) {
    const redirect = await Redirect.findOne({ slug: selectedSlug, userId: currentUser._id });
    await Redirect.deleteOne({ slug: selectedSlug, userId: currentUser._id });
    console.log(`✅ Redirect deleted: go/${selectedSlug}`);
    logger.info('Redirect deleted via CLI', {
      action: 'delete',
      slug: selectedSlug,
      deletedUrl: redirect ? redirect.url : 'unknown',
      userId: currentUser._id,
      service: 'cli'
    });
  } else {
    logger.info('Redirect deletion cancelled via CLI', {
      action: 'delete_cancelled',
      slug: selectedSlug,
      userId: currentUser._id,
      service: 'cli'
    });
  }
}

// List all redirects
async function listRedirects() {
  const redirects = await Redirect.find({ userId: currentUser._id }).sort({ slug: 1 });

  if (redirects.length === 0) {
    console.log('No redirects found for this user');
    return;
  }

  console.log(`\n📋 ${currentUser.name}'s Redirects:`);
  redirects.forEach(redirect => {
    console.log(`  go/${redirect.slug} → ${redirect.url}`);
  });
  console.log('');

  logger.info('Redirects listed via CLI', {
    action: 'list',
    count: redirects.length,
    userId: currentUser._id,
    service: 'cli'
  });
}

// Start the CLI
async function start() {
  console.log('🚀 Go Redirect CLI');
  logger.info('CLI started', { service: 'cli' });
  await connectDB();
  await selectUser();
  await mainMenu();
}

start().catch(console.error);