const fs = require('fs');
let html = '<html><body><h1>Cardiology 50 Question Mock Exam</h1><div class="questions">';
for (let i = 1; i <= 50; i++) {
    html += '<div class="q-block">';
    html += '<p><strong>' + i + '. A 55-year-old man presents with chest pain. This is a clinical vignette for question ' + i + '. What is the most likely diagnosis?</strong></p>';
    html += '<ol type="A">';
    html += '<li>Myocardial Infarction</li>';
    html += (i % 3 === 0) ? '<li><b>Pulmonary Embolism (Correct)</b></li>' : '<li>Pulmonary Embolism</li>';
    html += (i % 3 === 1) ? '<li><b>Aortic Dissection (Answer)</b></li>' : '<li>Aortic Dissection</li>';
    html += '<li>Gastroesophageal Reflux Disease</li>';
    html += (i % 3 === 2) ? '<li><b>Pericarditis *</b></li>' : '<li>Pericarditis</li>';
    html += '</ol>';
    html += '<p><i>Explanation: In this scenario, considering the presentation of question ' + i + ', the explanation is straightforward.</i></p>';
    html += '</div><hr />';
}
html += '</div></body></html>';
fs.writeFileSync('test_50_mcqs.html', html);
console.log('Created test file: test_50_mcqs.html');
