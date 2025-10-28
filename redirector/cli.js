#!/usr/bin/env node

const mongoose = require('mongoose');
const inquirer = require('inquirer');
const Redirect = require('./models/Redirect');
const logger = require('./utils/logger');

const MONGODB_URI = process.env.MONGODB_URI;

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
    const redirect = new Redirect({ slug: slug.trim(), url: url.trim() });
    await redirect.save();
    console.log(`✅ Redirect added: go/${slug} → ${url}`);
    logger.info('Redirect added via CLI', {
      action: 'add',
      slug: slug.trim(),
      url: url.trim(),
      service: 'cli'
    });
  } catch (error) {
    if (error.code === 11000) {
      console.log('❌ Error: Slug already exists');
      logger.warn('CLI add redirect failed - duplicate slug', {
        action: 'add',
        slug: slug.trim(),
        error: 'Slug already exists',
        service: 'cli'
      });
    } else {
      console.log('❌ Error:', error.message);
      logger.error('CLI add redirect failed', {
        action: 'add',
        slug: slug.trim(),
        error: error.message,
        service: 'cli'
      });
    }
  }
}// Edit existing redirect
async function editRedirect() {
  const redirects = await Redirect.find().sort({ slug: 1 });

  if (redirects.length === 0) {
    console.log('No redirects found');
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

  const redirect = await Redirect.findOne({ slug: selectedSlug });

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
      service: 'cli'
    });
  } catch (error) {
    console.log('❌ Error:', error.message);
    logger.error('CLI edit redirect failed', {
      action: 'edit',
      slug: selectedSlug,
      error: error.message,
      service: 'cli'
    });
  }
}

// Delete redirect
async function deleteRedirect() {
  const redirects = await Redirect.find().sort({ slug: 1 });

  if (redirects.length === 0) {
    console.log('No redirects found');
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
    const redirect = await Redirect.findOne({ slug: selectedSlug });
    await Redirect.deleteOne({ slug: selectedSlug });
    console.log(`✅ Redirect deleted: go/${selectedSlug}`);
    logger.info('Redirect deleted via CLI', {
      action: 'delete',
      slug: selectedSlug,
      deletedUrl: redirect ? redirect.url : 'unknown',
      service: 'cli'
    });
  } else {
    logger.info('Redirect deletion cancelled via CLI', {
      action: 'delete_cancelled',
      slug: selectedSlug,
      service: 'cli'
    });
  }
}

// List all redirects
async function listRedirects() {
  const redirects = await Redirect.find().sort({ slug: 1 });

  if (redirects.length === 0) {
    console.log('No redirects found');
    return;
  }

  console.log('\n📋 All Redirects:');
  redirects.forEach(redirect => {
    console.log(`  go/${redirect.slug} → ${redirect.url}`);
  });
  console.log('');

  logger.info('Redirects listed via CLI', {
    action: 'list',
    count: redirects.length,
    service: 'cli'
  });
}

// Start the CLI
async function start() {
  console.log('🚀 Go Redirect CLI');
  logger.info('CLI started', { service: 'cli' });
  await connectDB();
  await mainMenu();
}

start().catch(console.error);