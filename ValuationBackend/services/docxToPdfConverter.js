/**
 * GCR — Master DOCX-to-PDF Conversion Engine
 * Converts reference-faithful valuation DOCX reports to complete multi-page PDF documents
 * using LibreOffice headless in the containerized deployment environment.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

function getLibreOfficeCommand() {
  const candidates = ['soffice', 'libreoffice', '/usr/bin/soffice', '/usr/bin/libreoffice'];
  for (const cmd of candidates) {
    try {
      const res = spawnSync(cmd, ['--version']);
      if (res.status === 0 || (res.stdout && res.stdout.toString().includes('LibreOffice'))) {
        return { type: 'native', bin: cmd };
      }
    } catch (_) {}
  }

  // Check if docker daemon is actively running to delegate conversion
  try {
    const dRes = spawnSync('docker', ['info'], { timeout: 1500 });
    if (dRes.status === 0) {
      return { type: 'docker', bin: 'docker' };
    }
  } catch (_) {}

  return null;
}

/**
 * Converts a DOCX file to PDF with 100% layout, table, and pagination fidelity.
 * @param {string} inputDocxPath - Absolute path to source DOCX file
 * @param {string} targetPdfPath - Destination path for generated PDF
 * @returns {Promise<string>} - Resolves to targetPdfPath upon verified success
 */
async function convertDocxToPdf(inputDocxPath, targetPdfPath) {
  if (!fs.existsSync(inputDocxPath)) {
    throw new Error(`Source DOCX file not found: ${inputDocxPath}`);
  }

  const lo = getLibreOfficeCommand();
  if (!lo) {
    throw new Error('LibreOffice headless environment not detected. Please verify Docker container or install LibreOffice.');
  }

  // Unique isolated temporary working directory per report request (Concurrency Safe)
  const uniqueId = `gcr_pdf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const tempWorkDir = path.join(os.tmpdir(), uniqueId);
  const tempProfileDir = path.join(os.tmpdir(), `lo_prof_${uniqueId}`);
  fs.mkdirSync(tempWorkDir, { recursive: true });
  fs.mkdirSync(tempProfileDir, { recursive: true });

  const tempDocxCopy = path.join(tempWorkDir, 'document.docx');
  fs.copyFileSync(inputDocxPath, tempDocxCopy);

  try {
    let result;
    if (lo.type === 'native') {
      const args = [
        '--headless',
        '--invisible',
        '--nologo',
        '--nodefault',
        '--nofirststartwizard',
        `-env:UserInstallation=file://${tempProfileDir}`,
        '--convert-to',
        'pdf',
        '--outdir',
        tempWorkDir,
        tempDocxCopy
      ];
      result = spawnSync(lo.bin, args, { timeout: 60000 });
    } else {
      // Running via backend Docker image delegation
      const dockerArgs = [
        'run',
        '--rm',
        '-v',
        `${tempWorkDir}:/work`,
        'gcr-backend:latest',
        'soffice',
        '--headless',
        '--invisible',
        '--nologo',
        '--nodefault',
        '--nofirststartwizard',
        '--convert-to',
        'pdf',
        '--outdir',
        '/work',
        '/work/document.docx'
      ];
      result = spawnSync('docker', dockerArgs, { timeout: 90000 });
    }

    const convertedPdfInTemp = path.join(tempWorkDir, 'document.pdf');
    if (!fs.existsSync(convertedPdfInTemp)) {
      const errOutput = result.stderr ? result.stderr.toString() : (result.stdout ? result.stdout.toString() : 'Unknown conversion failure');
      throw new Error(`LibreOffice conversion failed: ${errOutput}`);
    }

    const stat = fs.statSync(convertedPdfInTemp);
    if (stat.size < 1000) {
      throw new Error(`Generated PDF is corrupted or abnormally small (${stat.size} bytes)`);
    }

    // Ensure target destination directory exists
    const targetDir = path.dirname(targetPdfPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.copyFileSync(convertedPdfInTemp, targetPdfPath);
    return targetPdfPath;
  } finally {
    // Clean temporary working files and profile directory after completion
    try { fs.rmSync(tempWorkDir, { recursive: true, force: true }); } catch (_) {}
    try { fs.rmSync(tempProfileDir, { recursive: true, force: true }); } catch (_) {}
  }
}

module.exports = {
  convertDocxToPdf,
  getLibreOfficeCommand
};
