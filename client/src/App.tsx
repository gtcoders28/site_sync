/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import EnterpriseLayout from './components/layouts/EnterpriseLayout';
import PartnerLayout from './components/layouts/PartnerLayout';
import DealerLayout from './components/layouts/DealerLayout';
import InfluencerLayout from './components/layouts/InfluencerLayout';
import StaffLayout from './components/layouts/StaffLayout';
import AuthFlow from './components/auth/AuthFlow';
import { useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

export default function App() {
  const { user, isLoading, acceptAuthentication, signOut } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen grid place-items-center bg-slate-50 text-slate-600">Restoring your session…</div>;
  }

  if (!user) {
    return <AuthFlow onAuthenticated={acceptAuthentication} />;
  }

  const renderLayout = () => {
    switch (user.role) {
      case 'platform_owner_distributor':
      case 'distributor':
        return <EnterpriseLayout onLogout={() => void signOut()} />;
      case 'dealer':
        return <DealerLayout onLogout={() => void signOut()} isRetailer={false} />;
      case 'retailer':
        return <DealerLayout onLogout={() => void signOut()} isRetailer={true} />;
      case 'staff':
        return <StaffLayout onLogout={() => void signOut()} />;
      case 'influencer':
        return <InfluencerLayout onLogout={() => void signOut()} />;
      case 'customer':
      default:
        return <PartnerLayout onLogout={() => void signOut()} />;
    }
  };

  return (
    <ErrorBoundary>
      {renderLayout()}
    </ErrorBoundary>
  );
}
