/*
 * Change Mail Form
 */

import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { t } from 'ttag';

import {
  validateEMail, validatePassword,
} from '../utils/validation.js';
import { requestMailChange } from '../store/actions/fetch.js';

function validate(havePassword, email, password) {
  const errors = [];

  if (havePassword) {
    const passerror = validatePassword(password);
    if (passerror) errors.push(passerror);
  }
  const mailerror = validateEMail(email);
  if (mailerror) errors.push(mailerror);

  return errors;
}

const ChangeMail = ({ done }) => {
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState([]);

  const havePassword = useSelector((state) => state.user.havePassword);

  const handleSubmit = async (evt) => {
    evt.preventDefault();
    if (submitting) {
      return;
    }

    const valErrors = validate(havePassword, email, password);
    if (valErrors.length > 0) {
      setErrors(valErrors);
      return;
    }

    setSubmitting(true);
    const { errors: respErrors } = await requestMailChange(email, password);
    setSubmitting(false);
    if (respErrors) {
      setErrors(respErrors);
      return;
    }
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="inarea">
        <p
          className="modalmessage"
        >
          {t`Changed Mail successfully. We sent you a verification mail, \
            please verify your new mail address.`}
        </p>
        <button type="button" onClick={done}>Close</button>
      </div>
    );
  }

  return (
    <div className="inarea">
      <form onSubmit={handleSubmit}>
        {errors.map((error) => (
          <p key={error} className="errormessage">
            <span>{t`Error`}</span>:&nbsp;
            {error}
          </p>
        ))}
        {(havePassword)
        && (
        <input
          value={password}
          onChange={(evt) => setPassword(evt.target.value)}
          type="password"
          placeholder={t`Password`}
        />
        )}
        <br />
        <input
          value={email}
          onChange={(evt) => setEmail(evt.target.value)}
          type="text"
          placeholder={t`New Mail`}
        />
        <br />
        <button type="submit">
          {(submitting) ? '...' : t`Save`}
        </button>
        <button type="button" onClick={done}>{t`Cancel`}</button>
      </form>
    </div>
  );
};

export default React.memo(ChangeMail);
