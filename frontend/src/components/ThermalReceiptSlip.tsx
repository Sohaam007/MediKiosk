import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface ThermalReceiptSlipProps {
  tokenNumber: string;
  patientName?: string;
  department?: string;
  chamberRoom?: string;
  doctorName?: string;
  triagePriority?: string;
  news2Score?: number;
  vitalsSummary?: string;
  wayfindingDirections?: string;
  timestamp?: string;
}

export const ThermalReceiptSlip: React.FC<ThermalReceiptSlipProps> = ({
  tokenNumber,
  patientName = 'PATIENT ENCOUNTER',
  department = 'General OPD',
  chamberRoom = 'OPD Chamber 102',
  doctorName = 'Attending Consultant',
  triagePriority = 'NORMAL',
  news2Score = 0,
  vitalsSummary,
  wayfindingDirections = 'Follow Green Floor Line to Chamber 102',
  timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
}) => {
  const qrVerificationPayload = JSON.stringify({
    token: tokenNumber,
    dept: department,
    room: chamberRoom,
    ts: timestamp,
    priority: triagePriority,
    news2: news2Score,
    vitals: vitalsSummary || 'N/A',
    verifier: 'MEDIKIOSK-NHA-HIP-V1',
  });

  return (
    <>
      <style>{`
        @media print {
          /* Hide all app chrome, headers, footers, and modals */
          body * {
            visibility: hidden !important;
          }
          /* Show strictly the 80mm thermal receipt */
          #thermal-receipt-slip,
          #thermal-receipt-slip * {
            visibility: visible !important;
          }
          #thermal-receipt-slip {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 76mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 2mm 3mm !important;
            color: #000000 !important;
            background: #FFFFFF !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 11px !important;
            line-height: 1.25 !important;
            border: none !important;
            box-shadow: none !important;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
      `}</style>

      <div
        id="thermal-receipt-slip"
        className="w-full max-w-[80mm] mx-auto p-4 bg-white text-black border-2 border-dashed border-slate-300 rounded-xl font-mono text-xs space-y-2 select-all print:p-0 print:border-none"
      >
        {/* Hospital Header */}
        <div className="text-center border-b border-black pb-2 space-y-0.5">
          <div className="font-black text-sm uppercase tracking-wider">
            AIIMS / MEDIKIOSK HOSPITAL OS
          </div>
          <div className="text-[10px]">National Health Authority ABDM Partner</div>
          <div className="text-[9px] text-slate-700">DPDP Act 2023 Digital Clinical Intake</div>
        </div>

        {/* Token Badge */}
        <div className="text-center py-2 border-b border-black">
          <div className="text-[10px] uppercase font-bold tracking-widest">QUEUE TOKEN NUMBER</div>
          <div className="text-3xl font-black tracking-tight">{tokenNumber}</div>
          <div className="text-[10px] font-bold mt-0.5 uppercase">
            PRIORITY: <span className="font-black underline">{triagePriority}</span>
            {news2Score > 0 && ` | NEWS2: ${news2Score}`}
          </div>
        </div>

        {/* Details Grid */}
        <div className="space-y-1 py-1 border-b border-black text-[10px]">
          <div className="flex justify-between">
            <span className="font-bold">PATIENT:</span>
            <span>{patientName}</span>
          </div>
          {vitalsSummary && (
            <div className="flex justify-between">
              <span className="font-bold">VITALS:</span>
              <span className="font-medium text-[9px]">{vitalsSummary}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="font-bold">DEPARTMENT:</span>
            <span>{department}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold">DOCTOR:</span>
            <span>{doctorName}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold">ROOM / CHAMBER:</span>
            <span className="font-black">{chamberRoom}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold">ISSUED AT:</span>
            <span>{timestamp}</span>
          </div>
        </div>

        {/* Bilingual Wayfinding Instructions */}
        <div className="py-1 border-b border-black space-y-1">
          <div className="font-bold text-[10px] uppercase">WAYFINDING ROUTE / मार्ग निर्देश:</div>
          <div className="text-[10px] leading-tight font-semibold">{wayfindingDirections}</div>
          <div className="text-[9px] text-slate-800">
            कृपया फर्श पर रंगीन रेखा का अनुसरण करें या सहायता डेस्क से संपर्क करें।
          </div>
        </div>

        {/* QR Verification Code */}
        <div className="flex flex-col items-center justify-center py-2 space-y-1">
          <QRCodeSVG value={qrVerificationPayload} size={84} level="M" />
          <div className="text-[8px] uppercase tracking-wider text-slate-700">
            Scan to Verify on Clinician Terminal
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[8px] text-slate-600 pt-1 border-t border-dotted border-black">
          <div>Automated Hospital Intake · 30-Day DPDP Retention</div>
          <div>Keep this slip until consultation is complete.</div>
        </div>
      </div>
    </>
  );
};
