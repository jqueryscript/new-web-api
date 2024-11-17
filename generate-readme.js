// generate-web-api-readme.js
const fs = require('fs');
const bcd = require('@mdn/browser-compat-data');

const START_YEAR = 2016;
const END_YEAR = new Date().getUTCFullYear();

const { browsers, api } = bcd;
const { chrome, safari, firefox } = browsers;

// Helper function to update dates for GMT
const updateForGMT = (date) => {
  date.setTime(date.getTime() + date.getTimezoneOffset() * 60 * 1000);
  return date;
};

// Process browser release dates
for (const browser of [chrome, safari, firefox]) {
  for (const release of Object.values(browser.releases)) {
    if (release.release_date) {
      const [YYYY, MM, DD] = release.release_date.split("-");
      release.release_date = updateForGMT(new Date(+YYYY, MM - 1, +DD));
    }
  }
}

// Collect features by year
const allSupportedFeatures = {};

// Recursive function to process nested API features
const processApiFeature = (feature, path = []) => {
  if (feature.__compat) {
    const support = feature.__compat.support;
    if (!support) return;

    const versions = {
      chrome: support.chrome?.version_added,
      firefox: support.firefox?.version_added,
      safari: support.safari?.version_added
    };

    // Skip if any browser doesn't support or if versions are non-numeric
    if (!versions.chrome || !versions.firefox || !versions.safari) return;
    if (!/^\d/.test(versions.chrome) || !/^\d/.test(versions.firefox) || !/^\d/.test(versions.safari)) return;

    const releaseDates = new Map();
    
    // Get release dates for each browser version
    for (const [browser, version] of Object.entries(versions)) {
      const browserObj = { chrome, firefox, safari }[browser];
      const releaseDate = browserObj.releases[version]?.release_date;
      if (releaseDate) {
        releaseDates.set(Number(releaseDate), `${browser} ${version}`);
      }
    }

    if (releaseDates.size === 0) return;

    const generalAvailabilityTime = Math.max(...releaseDates.keys());
    const generalAvailability = new Date(generalAvailabilityTime);
    const year = generalAvailability.getUTCFullYear();
    
    if (year < START_YEAR) return;

    // Determine the category (first level of the path)
    const category = path[0] || 'Global';
    const featureName = path.join('.');

    // Store feature information
    allSupportedFeatures[year] = allSupportedFeatures[year] || {};
    allSupportedFeatures[year][category] = allSupportedFeatures[year][category] || [];
    allSupportedFeatures[year][category].push({
      feature: featureName,
      description: feature.__compat.description || featureName,
      mdn_url: feature.__compat.mdn_url,
      support: versions
    });
  }

  // Process nested features
  for (const [key, value] of Object.entries(feature)) {
    if (key !== '__compat' && typeof value === 'object') {
      processApiFeature(value, [...path, key]);
    }
  }
};

// Process all API features
processApiFeature(api);

// Generate README content
let readmeContent = '# New Web APIs Since 2016\n\n';
readmeContent += 'A comprehensive list of new Web APIs by year of general availability across major browsers.\n\n';
readmeContent += '_This document is automatically generated weekly._\n\n';

let totalFeatures = 0;

for (let year = END_YEAR; year >= START_YEAR; year--) {
  if (!allSupportedFeatures[year]) continue;
  
  readmeContent += `## ${year}\n\n`;
  
  // Sort categories alphabetically
  const sortedCategories = Object.entries(allSupportedFeatures[year])
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [category, features] of sortedCategories) {
    if (features.length === 0) continue;
    
    readmeContent += `### ${category}\n\n`;
    
    // Sort features alphabetically within each category
    const sortedFeatures = [...features].sort((a, b) => 
      a.feature.localeCompare(b.feature)
    );

    sortedFeatures.forEach(feature => {
      totalFeatures++;
      const mdnLink = feature.mdn_url ? 
        `[${feature.description || feature.feature}](${feature.mdn_url})` : 
        (feature.description || feature.feature);
      readmeContent += `- ${mdnLink} (Chrome ${feature.support.chrome}, Firefox ${feature.support.firefox}, Safari ${feature.support.safari})\n`;
    });
    
    readmeContent += '\n';
  }
}

readmeContent += `## Summary\n\n`;
readmeContent += `Total Web APIs tracked: ${totalFeatures}\n`;
readmeContent += `\nLast updated: ${new Date().toISOString().split('T')[0]}\n`;

// Write to README.md
fs.writeFileSync('README.md', readmeContent);

console.log('README.md has been generated successfully!');
