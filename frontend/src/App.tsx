import { useState } from 'react';
import axios from 'axios';

export default function App() {
  const [formData, setFormData] = useState({
    full_name: '', email: '', phone: '', area_street: '', city: '', state: '', pincode: '', qualification_college: ''
  });

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const handleAcceptFromModal = () => {
    setAcceptedTerms(true);
    setShowTermsModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!acceptedTerms) {
      alert('You must read and accept the Terms and Conditions to submit your application form.');
      return;
    }
    
    const combinedAddress = `${formData.area_street}, ${formData.city}, ${formData.state} - ${formData.pincode}`;

    const payload = {
      full_name: formData.full_name,
      email: formData.email,
      phone: formData.phone,
      city: formData.city,
      address: combinedAddress,
      qualification_college: formData.qualification_college
    };

    try {
      const response = await axios.post('http://localhost:5000/api/register-candidate', payload);
      if (response.data.success) {
        setShowSuccessPopup(true);
        setAcceptedTerms(false);
        setFormData({
          full_name: '', email: '', phone: '', area_street: '', city: '', state: '', pincode: '', qualification_college: ''
        });
      }
    } catch (err) {
      alert('Connection error. Check that your Node API server is alive on port 5000.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex items-center justify-center p-4 sm:p-8 antialiased relative selection:bg-slate-900 selection:text-white">
      
      {/* SUCCESS MODAL POPUP LAYER */}
      {showSuccessPopup && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl border border-slate-100 transform transition-all animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-md font-bold text-slate-900 tracking-tight">Application Submitted</h3>
            <p className="text-slate-500 text-xs mt-2 leading-relaxed">Thank you for registering. Your candidate profile has been securely compiled and routed to our recruitment registry.</p>
            <button onClick={() => setShowSuccessPopup(false)} className="w-full mt-5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-2.5 rounded-xl transition shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-slate-900">Close Window</button>
          </div>
        </div>
      )}

      {/* ---------- TERMS AND CONDITIONS CONTENT MODAL ---------- */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200/60 flex flex-col max-h-[85vh] transform transition-all animate-in fade-in zoom-in-95 duration-200">
            
            <div className="p-5 border-b border-slate-100 bg-slate-900 text-white rounded-t-2xl flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Applicant Data Policy</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Please review the corporate terms of service</p>
              </div>
              <button onClick={() => setShowTermsModal(false)} className="text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-slate-800">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Modal Content - Merged neutrally like standardized corporate terms */}
            <div className="p-6 overflow-y-auto space-y-4 text-[11px] text-slate-600 leading-relaxed bg-slate-50/50">
              
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">1. Accuracy of Information</h4>
                <p>By submitting this application, you certify that all information provided—including your full name, contact coordinates, location parameters, and academic qualifications—is true, precise, and completely accurate to the best of your knowledge.</p>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 mb-1">2. Data Privacy & Processing Consent</h4>
                <p>We respect your privacy. The information captured through this career registry portal is securely recorded within our internal databases. We do not sell, rent, or distribute your personal profile parameters to unauthorized third-party marketing brokers.</p>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 mb-1">3. Processing Charges Disclaimer</h4>
                <p>Any funds, registration fees, or service deposits collected during this process are strictly allocated toward evaluating, processing, reviewing, and routing the candidate's profile application for available job openings.</p>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 mb-1">4. Placement Liability Policy</h4>
                <p>Submitting an application and paying processing charges does not guarantee employment. In the event that a candidate fails screening processes, interviews, or does not secure final recruitment selection or work placement, our administration holds absolutely no liability, and no claims for refunds will be entertained.</p>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 mb-1">5. Authorization to Contact</h4>
                <p>By ticking the acceptance option, you grant explicit consent to our internal HR recruitment team to contact you via your verified telephone number, SMS protocols, cellular networks, or email address regarding screening updates, interview scheduling, and job application tracking milestones.</p>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 mb-1">6. Application Lifespan</h4>
                <p>Your recorded profile data lines will remain active within our hiring management tracking spreadsheets for a standard validation cycle of 180 days to match active or upcoming resource vacancies across our operating locations.</p>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 mb-1">7. Communication Agreement</h4>
                <p>You allow our human resource representatives to get in touch with you using the phone number or digital contact information you provide on this registration form.</p>
              </div>

            </div>

            <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-end rounded-b-2xl">
              <button 
                onClick={handleAcceptFromModal}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-2 px-5 rounded-xl transition shadow-sm"
              >
                I Understand and Accept
              </button>
            </div>

          </div>
        </div>
      )}
      {/* ---------- END TERMS CONTENT MODAL ---------- */}

      {/* Primary Application Layout Box */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-w-lg w-full transition-all">
        
        {/* Header Design */}
        <div className="bg-slate-900 p-6 text-center border-b border-slate-800">
          <div className="inline-flex items-center gap-1.5 bg-slate-800 px-3 py-1 rounded-full border border-slate-700 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-300">Secure Candidate Portal</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Job Registration Form</h2>
          <p className="text-xs text-slate-400 mt-1">Provide your verified details to initialize human resource routing</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Full Name */}
          <div className="flex flex-col">
            <label className="text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Full Name <span className="text-rose-500">*</span></label>
            <input 
              type="text" 
              required 
              placeholder="First and last name" 
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition" 
              value={formData.full_name} 
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} 
            />
          </div>

          {/* Grid Layout for Contact info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label className="text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Email Address <span className="text-rose-500">*</span></label>
              <input 
                type="email" 
                required 
                placeholder="name@example.com" 
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition" 
                value={formData.email} 
                onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Phone Number <span className="text-rose-500">*</span></label>
              <input 
                type="tel" 
                required 
                placeholder="Mobile number" 
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition" 
                value={formData.phone} 
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
              />
            </div>
          </div>

          {/* Residential Address Subsection */}
          <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 mt-1">
            <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider block mb-3 pb-1 border-b border-slate-200/60">Residential Address</span>
            
            <div className="flex flex-col mb-3">
              <label className="text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Area / Street <span className="text-rose-500">*</span></label>
              <input 
                type="text" 
                required 
                placeholder="Flat No, Building, Block, Street Name" 
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition" 
                value={formData.area_street} 
                onChange={(e) => setFormData({ ...formData, area_street: e.target.value })} 
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">City <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  required 
                  placeholder="City" 
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition" 
                  value={formData.city} 
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })} 
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">State <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  required 
                  placeholder="State" 
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition" 
                  value={formData.state} 
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })} 
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Pincode <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  required 
                  placeholder="Pincode" 
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition" 
                  value={formData.pincode} 
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value })} 
                />
              </div>
            </div>
          </div>

          {/* Academic Info */}
          <div className="flex flex-col">
            <label className="text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Highest Qualification & Institution <span className="text-rose-500">*</span></label>
            <input 
              type="text" 
              required 
              placeholder="e.g., MBA - ABC Corporate University" 
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition" 
              value={formData.qualification_college} 
              onChange={(e) => setFormData({ ...formData, qualification_college: e.target.value })} 
            />
          </div>
          
          {/* TERMS AND CONDITIONS INLINE INPUT */}
          <div className="flex items-start gap-3 pt-1">
            <div className="flex items-center h-5">
              <input 
                id="terms"
                type="checkbox" 
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 accent-slate-900 cursor-pointer transition"
              />
            </div>
            <label htmlFor="terms" className="text-xs text-slate-500 select-none leading-normal cursor-pointer">
              I certify my statement configurations and accept the{' '}
              <button 
                type="button"
                onClick={() => setShowTermsModal(true)} 
                className="font-semibold text-slate-800 underline hover:text-slate-600 inline focus:outline-none transition decoration-slate-400"
              >
                Terms and Conditions
              </button>{' '}
              governing application deployment and evaluation processing. <span className="text-rose-500">*</span>
            </label>
          </div>
          
          {/* Submit Trigger Box */}
          <div className="pt-1 space-y-3">
            <button 
              type="submit" 
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl text-xs uppercase tracking-wider transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer focus:ring-2 focus:ring-offset-2 focus:ring-slate-900"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
              Verify & Submit Application
            </button>

            {/* Bottom Security Trust Signals Footer */}
            <div className="flex items-center justify-center gap-4 text-[10px] text-slate-400 font-medium pt-1">
              <div className="flex items-center gap-1">
                <span className="text-emerald-500 text-xs">🔒</span> 256-bit SSL Encryption
              </div>
              <div className="w-1 h-1 rounded-full bg-slate-300"></div>
              <div className="flex items-center gap-1">
                <span>🛡️</span> Secure Profile Vault
              </div>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}