/**
 * Touch Target Audit Script
 * Audits all interactive elements in frontend/src/ for 48x48px compliance.
 */

import fs from 'node:fs';
import path from 'node:path';

const filesToAudit = [
  'frontend/src/App.tsx',
  'frontend/src/views/ClinicianQueueView.tsx',
  'frontend/src/views/KioskIntakeView.tsx',
  'frontend/src/components/LanguageSelector.tsx',
  'frontend/src/components/EmergencyAlertModal.tsx'
];

console.log('=== SYSTEMATIC AUDIT OF TOUCH TARGETS (48x48px) ===\n');

// Helper to determine if className has min 48px height and width
function checkTouchTargetClasses(className) {
  if (!className) return { heightOk: false, widthOk: false, reason: 'No className' };

  const tokens = className.split(/\s+/);

  // Height check:
  // min-h-[48px], min-h-[72px], min-h-[80px], min-h-[96px], min-h-12, min-h-14, min-h-16, h-12, h-14, h-16, h-[48px]...
  const heightOk = tokens.some(t => {
    if (/^min-h-(\[?(\d+)px\]?|12|14|16|20|24)/.test(t)) {
      const match = t.match(/min-h-\[(\d+)px\]/);
      if (match) return parseInt(match[1], 10) >= 48;
      return true;
    }
    if (/^h-(\[?(\d+)px\]?|12|14|16|20|24)/.test(t)) {
      const match = t.match(/h-\[(\d+)px\]/);
      if (match) return parseInt(match[1], 10) >= 48;
      return true;
    }
    return false;
  });

  // Width check:
  // min-w-[48px], min-w-12, w-full, w-1/2, w-1/3, w-2/3, w-14, w-16, px-4, px-5, px-6, px-8, etc.
  // Note: if an element has px-4 (32px padding) + text/content, it is wider than 48px.
  // Or if it has w-full / w-1/2 / flex-1 / min-w-[...].
  const widthOk = tokens.some(t => {
    if (/^min-w-(\[?(\d+)px\]?|12|14|16|20|24)/.test(t)) {
      const match = t.match(/min-w-\[(\d+)px\]/);
      if (match) return parseInt(match[1], 10) >= 48;
      return true;
    }
    if (/^w-(full|1\/2|1\/3|2\/3|3\/4|(\[?(\d+)px\]?)|12|14|16|20)/.test(t)) {
      const match = t.match(/w-\[(\d+)px\]/);
      if (match) return parseInt(match[1], 10) >= 48;
      return true;
    }
    if (/^px-([4-9]|\d{2,})/.test(t)) return true; // px-4 = 32px padding, with text easily > 48px
    if (t === 'flex-1') return true;
    return false;
  });

  return { heightOk, widthOk, tokens };
}

let totalInteractive = 0;
let compliantInteractive = 0;
let nonCompliantElements = [];

for (const filePath of filesToAudit) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${filePath}`);
    continue;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n');

  console.log(`\n--- Inspecting ${filePath} ---`);

  // Simple regex parser for interactive JSX tags: button, input, select, textarea, role="button", role="radio"
  // Scan line by line or tag by tag
  const tagRegex = /<([a-zA-Z0-9]+)([^>]*?)(?:>|\/>)/gs;
  let match;

  while ((match = tagRegex.exec(content)) !== null) {
    const tagName = match[1];
    const attributes = match[2];

    const isInteractiveTag = ['button', 'input', 'select', 'textarea'].includes(tagName);
    const hasInteractiveRole = /role=["'](button|radio|checkbox|tab|link)["']/.test(attributes);
    const hasOnClick = /onClick=\{/.test(attributes) && (tagName === 'div' || tagName === 'span');

    if (isInteractiveTag || hasInteractiveRole || hasOnClick) {
      totalInteractive++;

      // Find line number
      const lineNum = content.substring(0, match.index).split('\n').length;

      // Extract className
      const classMatch = attributes.match(/className=(?:\{`([^`]+)`\}|"([^"]+)"|'([^']+)')/s);
      const rawClass = classMatch ? (classMatch[1] || classMatch[2] || classMatch[3] || '') : '';
      // Clean up template literal interpolations
      const cleanedClass = rawClass.replace(/\$\{[^}]+\}/g, ' ');

      const { heightOk, widthOk } = checkTouchTargetClasses(cleanedClass);

      // Check if both height and width satisfy >= 48px
      if (heightOk && widthOk) {
        compliantInteractive++;
      } else {
        const issue = [];
        if (!heightOk) issue.push('Height < 48px (missing min-h-[48px] / h-12)');
        if (!widthOk) issue.push('Width < 48px (missing min-w-[48px] / px-4 / w-full)');

        nonCompliantElements.push({
          file: filePath,
          line: lineNum,
          tag: tagName,
          role: hasInteractiveRole ? attributes.match(/role=["']([^"']+)["']/)?.[1] : null,
          issue: issue.join(', '),
          className: cleanedClass.trim()
        });
      }
    }
  }
}

console.log(`\n=== TOUCH TARGET AUDIT SUMMARY ===`);
console.log(`Total Interactive Elements Audited: ${totalInteractive}`);
console.log(`Fully Compliant (>=48x48px): ${compliantInteractive}`);
console.log(`Non-Compliant / Deficient: ${nonCompliantElements.length}`);

if (nonCompliantElements.length > 0) {
  console.log('\n--- Deficient Elements Detail ---');
  for (const item of nonCompliantElements) {
    console.log(`[NON-COMPLIANT] ${item.file}:${item.line} <${item.tag}> (Role: ${item.role || 'none'})`);
    console.log(`  Issue: ${item.issue}`);
    console.log(`  Classes: "${item.className}"\n`);
  }
} else {
  console.log('\n[PASS] All interactive elements satisfy minimum 48x48px touch targets!');
}
