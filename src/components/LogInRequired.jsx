/*
 * component that shows a login form if not loged in and its children otherwise
 */

import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';

import LogInForm from './LogInForm.jsx';

const LogInRequired = ({ children, title, reauthenticate }) => {
  const [forceReauth, setForceReauth] = useState(reauthenticate);
  const userId = useSelector((state) => state.user.id);
  useEffect(() => {
    setForceReauth(reauthenticate);
  }, [reauthenticate]);

  if (!userId || forceReauth) {
    return (
      <LogInForm
        title={title}
        denyThirdParty={forceReauth}
        hideDurationSelection={forceReauth}
        onLoginSucces={() => setForceReauth(false)}
      />
    );
  }
  return children;
};

export default LogInRequired;
