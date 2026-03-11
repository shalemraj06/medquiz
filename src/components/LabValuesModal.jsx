import React, { useState } from 'react';

export default function LabValuesModal({ onClose }) {
    const [activeTab, setActiveTab] = useState('blood');

    const labData = {
        blood: [
            { name: 'Hemoglobin (Male)', value: '13.5 - 17.5 g/dL' },
            { name: 'Hemoglobin (Female)', value: '12.0 - 15.5 g/dL' },
            { name: 'Hematocrit (Male)', value: '41 - 50%' },
            { name: 'Hematocrit (Female)', value: '36 - 48%' },
            { name: 'WBC Count', value: '4,500 - 11,000 /µL' },
            { name: 'Platelets', value: '150,000 - 450,000 /µL' },
            { name: 'Sodium (Na)', value: '135 - 145 mEq/L' },
            { name: 'Potassium (K)', value: '3.5 - 5.0 mEq/L' },
            { name: 'Chloride (Cl)', value: '98 - 106 mEq/L' },
            { name: 'Bicarbonate (HCO3)', value: '22 - 28 mEq/L' },
            { name: 'BUN', value: '7 - 20 mg/dL' },
            { name: 'Creatinine (Male)', value: '0.7 - 1.3 mg/dL' },
            { name: 'Creatinine (Female)', value: '0.6 - 1.1 mg/dL' },
            { name: 'Glucose (Fasting)', value: '70 - 99 mg/dL' },
            { name: 'Calcium', value: '8.5 - 10.5 mg/dL' },
            { name: 'Magnesium', value: '1.5 - 2.5 mEq/L' },
            { name: 'Phosphorus', value: '2.5 - 4.5 mg/dL' }
        ],
        gas: [
            { name: 'pH', value: '7.35 - 7.45' },
            { name: 'pCO2', value: '35 - 45 mmHg' },
            { name: 'pO2', value: '80 - 100 mmHg' },
            { name: 'HCO3', value: '22 - 26 mEq/L' },
            { name: 'O2 Saturation', value: '95 - 100%' }
        ],
        liver: [
            { name: 'AST', value: '8 - 48 U/L' },
            { name: 'ALT', value: '7 - 55 U/L' },
            { name: 'ALP', value: '40 - 129 U/L' },
            { name: 'Bilirubin (Total)', value: '0.1 - 1.2 mg/dL' },
            { name: 'Bilirubin (Direct)', value: '0.0 - 0.3 mg/dL' },
            { name: 'Albumin', value: '3.5 - 5.0 g/dL' },
            { name: 'Total Protein', value: '6.0 - 8.3 g/dL' }
        ],
        coag: [
            { name: 'PT', value: '11 - 13.5 sec' },
            { name: 'PTT', value: '25 - 35 sec' },
            { name: 'INR (Normal)', value: '0.8 - 1.1' },
            { name: 'INR (Therapeutic)', value: '2.0 - 3.0' }
        ],
        lipids: [
            { name: 'Total Cholesterol', value: '< 200 mg/dL' },
            { name: 'LDL', value: '< 100 mg/dL' },
            { name: 'HDL (Male)', value: '> 40 mg/dL' },
            { name: 'HDL (Female)', value: '> 50 mg/dL' },
            { name: 'Triglycerides', value: '< 150 mg/dL' }
        ],
        endocrine: [
            { name: 'TSH', value: '0.4 - 4.0 mIU/L' },
            { name: 'Free T4', value: '0.9 - 2.3 ng/dL' },
            { name: 'HbA1c (Normal)', value: '< 5.7%' },
            { name: 'Cortisol (8 AM)', value: '5 - 23 µg/dL' }
        ]
    };

    const tabs = [
        { id: 'blood', label: 'CBC / BMP' },
        { id: 'gas', label: 'ABG' },
        { id: 'liver', label: 'Liver / LFT' },
        { id: 'coag', label: 'Coags' },
        { id: 'lipids', label: 'Lipids' },
        { id: 'endocrine', label: 'Endocrine' }
    ];

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={onClose}>
            <div style={{
                background: 'var(--bg-main)',
                width: '600px',
                maxWidth: '95vw',
                height: '500px',
                maxHeight: '90vh',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                animation: 'slideUp 0.3s ease-out'
            }} onClick={e => e.stopPropagation()}>
                <div style={{
                    padding: '1rem',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--bg-card)'
                }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        💉 Normal Lab Values
                    </h3>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer',
                        color: 'var(--text-muted)'
                    }}>✕</button>
                </div>

                <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--border)', background: 'var(--bg-input)' }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: '0.75rem 1rem',
                                background: 'none',
                                border: 'none',
                                borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                                color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontWeight: activeTab === tab.id ? 600 : 400,
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: 'var(--bg-main)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                            {labData[activeTab].map((item, idx) => (
                                <tr key={idx} style={{
                                    borderBottom: '1px solid var(--border)',
                                    background: idx % 2 === 0 ? 'transparent' : 'var(--bg-card)'
                                }}>
                                    <td style={{ padding: '0.75rem', fontWeight: 500, color: 'var(--text-main)' }}>{item.name}</td>
                                    <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--text-secondary)' }}>{item.value}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
