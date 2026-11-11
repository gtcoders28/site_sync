import React, { useState, useEffect } from 'react';
import {
  Store,
  Building2,
  Phone,
  LogIn,
  ArrowLeft,
  ArrowRight,
  UserCircle2,
  Megaphone,
  Check,
  AlertCircle,
  Sparkles,
  RefreshCw,
  UserCheck,
} from 'lucide-react';
import { apiClient, ApiError } from '../../lib/api/client';
import { authApi, type AuthResult, type PublicRole, type AuthenticatedUser } from '../../lib/api/auth';
import { useAuth } from '../../context/AuthContext';
import { CustomDropdown } from '../ui/CustomDropdown';
import { SearchableSelect, INDIAN_STATES_AND_UTS } from '../ui/SearchableSelect';

interface AuthFlowProps {
  onAuthenticated: (result: AuthResult) => void;
}

const AUTH_ROLES = [
  { id: 'distributor', label: 'Distributor', icon: Building2, activeColor: 'text-slate-900', loginOnly: true },
  { id: 'dealer', label: 'Dealer', icon: Store, activeColor: 'text-orange-600', loginOnly: false },
  { id: 'retailer', label: 'Retailer', icon: Store, activeColor: 'text-emerald-600', loginOnly: false },
  { id: 'staff', label: 'Staff Member', icon: UserCheck, activeColor: 'text-amber-600', loginOnly: true },
  { id: 'influencer', label: 'Influencer', icon: Megaphone, activeColor: 'text-purple-600', loginOnly: false },
  { id: 'customer', label: 'Customer', icon: UserCircle2, activeColor: 'text-blue-600', loginOnly: false },
] as const;

export default function AuthFlow({ onAuthenticated }: AuthFlowProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<'distributor' | 'dealer' | 'retailer' | 'staff' | 'customer' | 'influencer'>('distributor');
  const [step, setStep] = useState(1);
  const [maxStep, setMaxStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Credentials
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');

  // Distributor Specific
  const [companyName, setCompanyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [gstNumber, setGstNumber] = useState('');

  // Dealer / Retailer Specific
  const [parentDealerId, setParentDealerId] = useState('');
  const [shopName, setShopName] = useState('');

  // Customer Specific
  const [onboardingDealerId, setOnboardingDealerId] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [name, setName] = useState('');

  // Influencer Specific
  const [dealerId, setDealerId] = useState('');

  // Location
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('Delhi');
  const [pincode, setPincode] = useState('');

  // Live options loaded from database
  const [dealerList, setDealerList] = useState<Array<{ rawId: string; name: string; dealerType?: string; distributorId?: string | null; city?: string }>>([]);
  const [dealersLoading, setDealersLoading] = useState(true);
  const [dealersError, setDealersError] = useState('');

  const wholesaleDealerList = dealerList.filter((d) => d.dealerType === 'dealer');
  const isRetailerSignup = role === 'retailer';

  useEffect(() => {
    let isMounted = true;
    setDealersLoading(true);
    setDealersError('');

    apiClient
      .get<Array<{ dealer_id: string; distributor_id?: string | null; shop_name?: string; owner_name?: string; dealer_type?: string; city?: string }>>(
        '/auth/public-dealers',
        { skipRefresh: true }
      )
      .then((res) => {
        if (!isMounted) return;
        if (res.success && Array.isArray(res.data)) {
          const list = res.data.map((d) => ({
            rawId: d.dealer_id,
            name: d.shop_name || d.owner_name || '',
            dealerType: d.dealer_type,
            distributorId: d.distributor_id,
            city: d.city,
          }));
          setDealerList(list);
          if (list.length > 0) {
            setDealerId((prev) => prev || list[0].rawId);
            setOnboardingDealerId((prev) => prev || list[0].rawId);
          }
        } else {
          setDealersError('Unable to load active dealers.');
        }
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setDealersError(err?.message || 'Unable to load active dealers.');
      })
      .finally(() => {
        if (isMounted) setDealersLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isLogin && (role === 'distributor' || role === 'staff')) {
      setRole('dealer');
      setParentDealerId('');
    }
  }, [isLogin, role]);

  const validateRegistrationStep = (targetStep: number): boolean => {
    const cleanMobile = mobileNumber.replace(/\D/g, '').slice(-10);
    if (targetStep === 1) {
      if (!cleanMobile || cleanMobile.length !== 10) {
        setErrorMessage('Please enter a valid 10-digit mobile number.');
        return false;
      }
      if (!password || password.length < 6) {
        setErrorMessage('Password must be at least 6 characters.');
        return false;
      }
    } else if (targetStep === 2) {
      if (role === 'dealer' || role === 'retailer') {
        if (isRetailerSignup && parentDealerId && !wholesaleDealerList.some((d) => d.rawId === parentDealerId)) {
          setErrorMessage('Please select a valid wholesale dealer or choose None.');
          return false;
        }
        if (!shopName.trim()) {
          setErrorMessage('Please enter your Firm / Shop Name.');
          return false;
        }
        if (!ownerName.trim()) {
          setErrorMessage('Please enter the Owner Name.');
          return false;
        }
      } else if (role === 'customer') {
        if (!name.trim()) {
          setErrorMessage('Please enter your full name.');
          return false;
        }
      } else if (role === 'influencer') {
        if (!name.trim()) {
          setErrorMessage('Please enter your full name.');
          return false;
        }
        if (!dealerId || !dealerList.some((d) => d.rawId === dealerId)) {
          setErrorMessage(dealersError || 'Please select an active associated dealer.');
          return false;
        }
      }
    }
    return true;
  };

  const handlePrevious = () => {
    if (isLoading || step <= 1) return;
    setErrorMessage('');
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleStepSelect = (targetStep: number) => {
    if (isLoading || targetStep === step || targetStep < 1 || targetStep > 3) return;
    setErrorMessage('');
    if (targetStep < step) {
      setStep(targetStep);
      return;
    }
    if (targetStep <= maxStep) {
      for (let s = step; s < targetStep; s += 1) {
        if (!validateRegistrationStep(s)) {
          setStep(s);
          return;
        }
      }
      setStep(targetStep);
    }
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const cleanMobile = mobileNumber.replace(/\D/g, '').slice(-10);

    if (isLogin) {
      if (!cleanMobile || cleanMobile.length !== 10) {
        setErrorMessage('Please enter a valid 10-digit mobile number.');
        return;
      }

      setIsLoading(true);
      try {
        const res = await authApi.signIn(role, { mobileNumber: cleanMobile, password });
        if (res.data?.user) {
          onAuthenticated(res);
          return;
        }
      } catch (err: any) {
        console.warn('Sign in attempt error:', err);
        setErrorMessage(err.message || 'Invalid mobile number or password.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (role === 'distributor') {
      setRole('dealer');
      return;
    }

    if (step < 3) {
      if (!validateRegistrationStep(step)) return;
      const nextStep = step + 1;
      setStep(nextStep);
      setMaxStep((prev) => Math.max(prev, nextStep));
      return;
    }

    // Final Signup Step
    if (!cleanMobile || cleanMobile.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      setStep(1);
      return;
    }

    setIsLoading(true);
    try {
      let payload: Record<string, unknown> = {};
      let signupRole: Exclude<PublicRole, 'distributor' | 'staff'> = role as Exclude<PublicRole, 'distributor' | 'staff'>;

      if (role === 'dealer' || role === 'retailer') {
        const selectedParentDealerId = isRetailerSignup && parentDealerId ? parentDealerId : undefined;
        signupRole = isRetailerSignup ? 'retailer' : 'dealer';
        payload = {
          ...(selectedParentDealerId ? { parentDealerId: selectedParentDealerId } : {}),
          mobileNumber: cleanMobile,
          password,
          shopName: shopName.trim(),
          ownerName: ownerName.trim(),
          dealerType: isRetailerSignup ? 'retailer' : 'dealer',
          gstNumber: gstNumber.trim() || undefined,
          city: city.trim() || 'Delhi',
          state: stateName.trim() || 'Delhi',
          pincode: pincode.trim() || '110001',
        };
      } else if (role === 'customer') {
        payload = {
          onboardingDealerId: onboardingDealerId || undefined,
          referralCode: referralCode.trim() || undefined,
          mobileNumber: cleanMobile,
          password,
          name: name.trim(),
          email: email.trim() || undefined,
          city: city.trim() || 'Delhi',
          state: stateName.trim() || 'Delhi',
          pincode: pincode.trim() || '110001',
          createdByType: 'self',
        };
      } else if (role === 'influencer') {
        if (!dealerId) {
          setErrorMessage(dealersError || 'Please select a valid associated dealer.');
          setStep(2);
          setIsLoading(false);
          return;
        }
        payload = {
          dealerId,
          mobileNumber: cleanMobile,
          password,
          name: name.trim(),
          city: city.trim() || 'Delhi',
          state: stateName.trim() || 'Delhi',
        };
      }

      const result = await authApi.signUp(signupRole, payload);
      setSuccessMessage(result.message || 'Registration completed successfully!');
      if (result.data?.tokens?.accessToken) {
        onAuthenticated(result);
      }
    } catch (err: any) {
      console.error('Sign up error:', err);
      setErrorMessage(err.message || 'Registration failed. Please verify your details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      {/* Left side - Branding (Hidden on mobile) */}
      <div className="hidden lg:flex flex-1 bg-slate-950 text-white flex-col justify-between p-12 relative overflow-hidden border-r border-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 text-white">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 via-orange-500 to-amber-500 flex items-center justify-center font-black shadow-lg shadow-orange-500/20 text-white">
              S
            </div>
            <div>
              <span className="text-2xl font-bold tracking-tight text-white">
                Structura<span className="text-orange-400">Sync</span>
              </span>
              <span className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Enterprise Materials Platform
              </span>
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-lg space-y-6 my-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold text-orange-400">
            <Sparkles size={14} /> Production Enterprise Portal
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight text-white">
            Distribution intelligence for modern supply chains.
          </h1>
          <p className="text-slate-400 text-base leading-relaxed">
            Manage your dealer network, automate bulk material orders, track secondary sales, and reward verified
            trade partners in one unified platform.
          </p>
        </div>

        <div className="relative z-10 text-xs text-slate-500 border-t border-slate-900 pt-6">
          © {new Date().getFullYear()} Structura Enterprise Systems. All rights reserved.
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 relative overflow-y-auto">
        <div className="w-full max-w-md my-auto pb-10">
          {successMessage ? (
            <div className="text-center animate-in fade-in zoom-in-95 duration-300 bg-white p-8 rounded-2xl border border-slate-200/80 shadow-lg">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                <Check size={32} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Registration Submitted</h2>
              <p className="text-slate-600 text-sm mb-6 leading-relaxed">{successMessage}</p>
              <button
                onClick={() => {
                  setSuccessMessage('');
                  setIsLogin(true);
                  setStep(1);
                  setMaxStep(1);
                }}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-xs"
              >
                Return to Login
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
                  {isLogin ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p className="text-slate-500 text-sm">
                  {isLogin
                    ? 'Enter your mobile credentials to access your portal'
                    : `Setup your ${role} profile (Step ${step}/3)`}
                </p>

                {!isLogin && (
                  <div className="mt-4 flex items-center justify-center gap-2" aria-label="Registration steps">
                    {[
                      { num: 1, label: 'Account' },
                      { num: 2, label: 'Details' },
                      { num: 3, label: 'Location' },
                    ].map((s, idx) => {
                      const isCurrent = step === s.num;
                      const isCompleted = s.num < step;
                      const isClickable = s.num < step || (s.num <= maxStep && s.num !== step);
                      return (
                        <React.Fragment key={s.num}>
                          <button
                            type="button"
                            disabled={!isClickable && !isCurrent}
                            onClick={() => isClickable && handleStepSelect(s.num)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all border ${
                              isCurrent
                                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                : isCompleted
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 cursor-pointer'
                                : s.num <= maxStep
                                ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 cursor-pointer'
                                : 'bg-slate-100 text-slate-400 border-transparent cursor-default'
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                                isCurrent
                                  ? 'bg-white/20 text-white'
                                  : isCompleted
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-200 text-slate-500'
                              }`}
                            >
                              {isCompleted ? <Check size={10} /> : s.num}
                            </span>
                            <span>{s.label}</span>
                          </button>
                          {idx < 2 && <div className={`h-px w-4 ${s.num < step ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}

                {errorMessage && (
                  <div
                    role="alert"
                    className="mt-4 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs font-semibold text-rose-800 text-left flex items-start gap-2.5"
                  >
                    <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span>{errorMessage}</span>
                      <button
                        type="button"
                        onClick={() => setErrorMessage('')}
                        className="block text-rose-900 underline mt-1 font-bold"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Role Selector */}
              {step === 1 && (
                <div
                  className={`grid ${
                    isLogin ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'
                  } gap-1.5 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/70`}
                >
                  {AUTH_ROLES.filter((r) => !r.loginOnly || isLogin).map((r) => {
                    const Icon = r.icon;
                    const isActive = role === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setRole(r.id as any);
                          setMaxStep(1);
                          setErrorMessage('');
                          if (r.id === 'dealer') {
                            setParentDealerId('');
                          }
                        }}
                        className={`relative py-2.5 px-2 text-xs font-bold rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-150 cursor-pointer outline-none focus:outline-none select-none border ${
                          isActive
                            ? `bg-white shadow-xs border-slate-200/90 ${r.activeColor}`
                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-white/50'
                        }`}
                      >
                        <Icon size={16} className="shrink-0" />
                        <span className="truncate text-[11px] font-bold">{r.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Login/Signup Form */}
              <form onSubmit={handleNext} className="space-y-4">
                {step === 1 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Mobile Number
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                        <input
                          type="tel"
                          required
                          value={mobileNumber}
                          onChange={(e) => setMobileNumber(e.target.value)}
                          placeholder="10-digit mobile number"
                          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Password
                      </label>
                      <div className="relative">
                        <LogIn className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Role Details (Signup Only) */}
                {step === 2 && !isLogin && (
                  <div className="space-y-3.5">
                    {(role === 'dealer' || role === 'retailer') && (
                      <>
                        {isRetailerSignup && (
                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                              Parent Dealer (Optional)
                            </label>
                            <CustomDropdown
                              value={parentDealerId}
                              onChange={setParentDealerId}
                              disabled={dealersLoading}
                              placeholder={dealersLoading ? 'Loading wholesale dealers...' : 'None (Assign under Platform Distributor)'}
                              options={[
                                { value: '', label: 'None (Assign under Platform Distributor)' },
                                ...wholesaleDealerList.map((d) => ({
                                  value: d.rawId,
                                  label: d.city ? `${d.name} (${d.city})` : d.name,
                                })),
                              ]}
                              className="w-full"
                              buttonClassName="w-full py-2.5"
                              menuClassName="w-full"
                            />
                            <p className="mt-1 text-[11px] text-slate-500">
                              Select a parent wholesale dealer or leave as None to register directly under the platform distributor.
                            </p>
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Firm / Shop Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={shopName}
                            onChange={(e) => setShopName(e.target.value)}
                            placeholder="e.g. Royal Building Materials"
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Owner Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={ownerName}
                            onChange={(e) => setOwnerName(e.target.value)}
                            placeholder="e.g. Rakesh Aggarwal"
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            GSTIN (Optional)
                          </label>
                          <input
                            type="text"
                            value={gstNumber}
                            onChange={(e) => setGstNumber(e.target.value)}
                            placeholder="07AAAAA0000A1Z5"
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                          />
                        </div>
                      </>
                    )}

                    {role === 'customer' && (
                      <>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Customer Full Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Vikas Sharma"
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Associated Dealer (Optional)
                          </label>
                          <CustomDropdown
                            value={onboardingDealerId}
                            onChange={setOnboardingDealerId}
                            options={[
                              { value: '', label: 'Direct Customer (No Assigned Dealer)' },
                              ...dealerList.map((d) => ({ value: d.rawId, label: d.name })),
                            ]}
                            className="w-full"
                            buttonClassName="w-full py-2.5"
                            menuClassName="w-full"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Email Address (Optional)
                          </label>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="user@example.com"
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Referral Invite Code (Optional)
                          </label>
                          <input
                            type="text"
                            value={referralCode}
                            onChange={(e) => setReferralCode(e.target.value)}
                            placeholder="CUST-XXXXXX"
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                          />
                        </div>
                      </>
                    )}

                    {role === 'influencer' && (
                      <>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Contractor / Engineer Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Er. Raman Verma"
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Associated Dealer *
                          </label>
                          {dealersLoading ? (
                            <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                              Loading active dealers...
                            </div>
                          ) : dealerList.length === 0 ? (
                            <div className="px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                              {dealersError || 'No active dealers found right now. Please try again later.'}
                            </div>
                          ) : (
                            <CustomDropdown
                              value={dealerId}
                              onChange={setDealerId}
                              placeholder="Select associated dealer..."
                              options={dealerList.map((d) => ({
                                value: d.rawId,
                                label: d.city ? `${d.name} (${d.city})` : d.name,
                              }))}
                              className="w-full"
                              buttonClassName="w-full py-2.5"
                              menuClassName="w-full"
                            />
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Step 3: Location (Signup Only) */}
                {step === 3 && !isLogin && (
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        City / District *
                      </label>
                      <input
                        type="text"
                        required
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Delhi"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          State / UT *
                        </label>
                        <SearchableSelect
                          value={stateName}
                          onChange={setStateName}
                          options={INDIAN_STATES_AND_UTS}
                          placeholder="Search or select state..."
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Pincode
                        </label>
                        <input
                          type="text"
                          value={pincode}
                          onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="110001"
                          maxLength={6}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className={!isLogin && step > 1 ? 'grid grid-cols-2 gap-3 pt-1' : 'pt-1'}>
                  {!isLogin && step > 1 && (
                    <button
                      type="button"
                      onClick={handlePrevious}
                      disabled={isLoading}
                      className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                    >
                      <ArrowLeft size={16} />
                      <span>Previous</span>
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs hover:shadow active:scale-[0.98] disabled:opacity-70 cursor-pointer"
                  >
                    {isLoading ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (
                      <>
                        <span>{isLogin ? 'Sign In Securely' : step < 3 ? 'Next' : 'Complete Setup'}</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextIsLogin = !isLogin;
                    setIsLogin(nextIsLogin);
                    setStep(1);
                    setMaxStep(1);
                    setErrorMessage('');
                    if (!nextIsLogin && (role === 'distributor' || role === 'staff')) {
                      setRole('dealer');
                      setParentDealerId('');
                    } else if (!nextIsLogin && role === 'dealer') {
                      setParentDealerId('');
                    }
                  }}
                  className="text-xs text-slate-500 hover:text-slate-900 font-semibold"
                >
                  {isLogin ? "Need a new account? Register now" : "Already registered? Sign in"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
