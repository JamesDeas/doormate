const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const createPDF = (title, content, outputPath) => {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(outputPath));

  // Add title
  doc.fontSize(25).text(title, { align: 'center' });
  doc.moveDown();

  // Add content
  doc.fontSize(12).text(content);

  doc.end();
};

const manualTypes = [
  {
    filename: 'hs100-install.pdf',
    title: 'High-Speed Door HS100 Installation Manual',
    content: `Installation Instructions for High-Speed Door HS100

1. Safety Precautions
- Read all instructions before beginning installation
- Use appropriate personal protective equipment
- Follow local building codes and regulations

2. Tools Required
- Power drill and bits
- Level
- Measuring tape
- Socket set
- Allen keys

3. Installation Steps
3.1 Prepare the opening
3.2 Mount the side guides
3.3 Install the header assembly
3.4 Connect power supply
3.5 Install safety devices
3.6 Program limits and features

4. Testing and Commissioning
- Check all safety devices
- Test emergency operation
- Verify proper opening and closing speeds
- Train end users on operation`
  },
  {
    filename: 'hs100-user.pdf',
    title: 'High-Speed Door HS100 User Guide',
    content: `User Guide for High-Speed Door HS100

1. Daily Operation
- Opening and closing procedures
- Emergency stop usage
- Manual operation in case of power failure

2. Safety Features
- Light curtain operation
- Safety edge function
- Emergency stop locations

3. Maintenance
- Daily checks
- Weekly inspections
- Monthly maintenance tasks

4. Troubleshooting
- Common issues and solutions
- When to call for service
- Error code reference`
  }
];

// Create the manuals directory if it doesn't exist
const manualsDir = path.join(__dirname, '../public/manuals');
if (!fs.existsSync(manualsDir)) {
  fs.mkdirSync(manualsDir, { recursive: true });
}

// Create each manual
manualTypes.forEach(manual => {
  const outputPath = path.join(manualsDir, manual.filename);
  createPDF(manual.title, manual.content, outputPath);
  console.log(`Created ${manual.filename}`);
}); 