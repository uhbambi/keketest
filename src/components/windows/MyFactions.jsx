/*
 * user faction overview
 */
import React, { useMemo, useState, useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { t } from 'ttag';

import {
  validateFactionName, validateFactionTitle, validateDescription,
} from '../../utils/validation.js';
import { cdn } from '../../utils/utag.js';
import { getUrlsFromMediaIdAndName } from '../../utils/media/utils.js';
import {
  changeProfile, changeUserFaction,
} from '../../store/actions/thunks.js';
import {
  requestCreateFaction,
} from '../../store/actions/fetch.js';
import {
  applyPatches,
} from '../../store/actions/index.js';
import FileUpload from '../FileUpload.jsx';
import useProfile from '../hooks/useProfile.js';
import useLink from '../hooks/link.js';

/* eslint-disable max-len */


const FactionAvatar = ({ avatarId }) => {
  const [, thumb] = getUrlsFromMediaIdAndName(avatarId, 'avatar');
  let avatarStyle;
  if (thumb) {
    avatarStyle = {
      backgroundImage: `url(${cdn`${thumb}`})`,
    };
  }
  return (
    <div className="factionavatar" style={avatarStyle}>
      {!avatarId && '#'}
    </div>
  );
};


const MyFactions = () => {
  const [selected, setSelected] = useState(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [page, setPage] = useState('list');
  const uploadRef = useRef();

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState([]);

  const [factions, activeFactionRole, fetched] = useProfile((profile) => [
    profile.factions,
    profile.activeFactionRole,
  ]);
  const link = useLink();
  const dispatch = useDispatch();

  const changePage = useCallback((newPage) => () => {
    setSubmitting(false);
    setErrors([]);
    setPage(newPage);
  }, []);

  const [
    activeFaction, activeFactionTitle, activeRoleName, activeCustomFlagId,
  ] = useMemo(() => {
    for (let i = 0; i < factions.length; i += 1) {
      const roles = factions[i];
      for (let u = 0; u < roles.length; u += 1) {
        if (roles[u].frid === activeFactionRole) {
          return [
            factions[i].fid,
            factions[i].title,
            roles[u].name,
            roles[u].customFlagId,
          ];
        }
      }
    }
    return [null, '', '', null];
  }, [factions, activeFactionRole]);

  const setActiveRole = useCallback(async (gActiveFactionRole = null) => {
    const respErrors = await dispatch(
      changeProfile({ activeFactionRole: gActiveFactionRole }),
    );
    setErrors((oErrors) => {
      if (respErrors) {
        return respErrors;
      }
      return oErrors.length ? [] : oErrors;
    });
  }, []);

  const setFactionHidden = useCallback(async (fid, isHidden) => {
    const respErrors = await dispatch(
      changeUserFaction({ fid, isHidden }),
    );
    setErrors((oErrors) => {
      if (respErrors) {
        return respErrors;
      }
      return oErrors.length ? [] : oErrors;
    });
  }, []);

  const submitCreateFaction = useCallback(async (evt) => {
    evt.preventDefault();
    if (submitting) {
      return;
    }
    const name = evt.target.name.value;
    const title = evt.target.title.value;
    const description = evt.target.description.value;
    const isPrivate = evt.target.isprivate.checked;
    const isPublic = evt.target.ispublic.checked;

    const valErrors = [];
    let error = validateFactionName(name);
    if (error) valErrors.push(error);
    error = validateFactionTitle(title);
    if (error) valErrors.push(error);
    error = validateDescription(description);
    if (error) valErrors.push(error);
    if (valErrors.length) {
      setErrors(valErrors);
      return;
    }

    setSubmitting(true);
    const files = await uploadRef.current?.();
    if (files.length !== 1) {
      setErrors([t`You must select an avatar for your faction`]);
    } else {
      const avatarId = files[0].mediaId;
      const {
        errors: respErrors, patches,
      } = await requestCreateFaction(
        name, title, description, isPrivate, isPublic, avatarId,
      );
      if (patches) {
        dispatch(applyPatches(patches));
      }
      if (respErrors) {
        setErrors(respErrors);
      } else {
        setErrors([]);
        setPage('list');
      }
    }
    setSubmitting(false);
  }, [submitting]);

  return (
    <div className="content">
      {(() => {
        if (!fetched) {
          return (<div className="content">{t`Loading...`}</div>);
        }

        if (page === 'create') {
          /*
           * name, title, description, isPrivate, isPublic
           */
          return (
            <React.Fragment key="create">
              <div className="client-form-box">
                <h2>{t`Create Faction`}</h2>
                <form onSubmit={submitCreateFaction} className="client-form">
                  <div className="form-group">
                    <label>{t`Name`}:
                      <input
                        type="text"
                        name="name"
                        placeholder="Name"
                        required
                      /></label>
                    <small>{t`Name of your faction [a-z][A-Z][0-9].-_`}</small>
                  </div>

                  <div className="form-group form-group-avatar">
                    <span>{t`Avatar`}:
                      <FileUpload
                        acceptedTypes="image/*"
                        maxFiles={1}
                        uploadRef={uploadRef}
                        minHeight={50}
                      /></span>
                    <small>{t`An image representing your faction`}</small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="title">{t`Title`}:
                      <input
                        type="text"
                        name="title"
                        placeholder="title"
                        required
                      /></label>
                    <small>{t`Title of your faction`}</small>
                  </div>

                  <div className="form-group">
                    <label>{t`Description`}:
                      <textarea
                        name="description"
                        placeholder={t`Enter a little text that describes your faction`}
                        rows="3"
                        required
                      /></label>
                    <small>{t`Description of your faction`}</small>
                  </div>

                  <div className="form-group checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="isprivate"
                        value="true"
                      />
                      <span className="checkmark" />
                      {t`Don't show faction in search`}
                    </label>
                    <small>{t`Don't let people find this faction in public search or look at its profile.`}</small>
                  </div>

                  <div className="form-group checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="ispublic"
                        value="true"
                      />
                      <span className="checkmark" />
                      {t`Let everyone join this faction`}
                    </label>
                    <small>{t`Let people join this faction without needing an invite.`}</small>
                  </div>

                  {errors.map((error) => (
                    <p key={error} className="errormessage">
                      <span>{t`Error`}</span>:&nbsp;{error}</p>
                  ))}
                  <div className="form-actions">
                    <button
                      type="submit"
                      disabled={submitting}
                    >
                      {t`Submit`}
                    </button>
                    <button
                      type="button"
                      onClick={changePage('list')}
                    >
                      {t`Cancel`}
                    </button>
                  </div>
                </form>
              </div>
            </React.Fragment>
          );
        }
        return (
          <React.Fragment key="list">
            <h2>{t`Your Factions`}</h2>
            {errors.map((error) => (
              <p key={error} className="errormessage">
                <span>{t`Error`}</span>:&nbsp;{error}</p>
            ))}
            {(factions.length > 0) ? (
              <React.Fragment key="fl">
                {(activeFaction) ? (
                  <p key="pres">
                    {`${t`You are currently representing ${activeFactionTitle} as ${activeRoleName}`} `}
                    {(activeCustomFlagId) && (
                    <img
                      className="chatflag"
                      src={cdn`${getUrlsFromMediaIdAndName(activeCustomFlagId)[0]}`}
                      alt=""
                    />
                    )}.
                    <span
                      role="button"
                      tabIndex={-1}
                      className="modallink"
                      onClick={setActiveRole}
                    >
                      {t`Click here to cease representation.`}
                    </span>
                  </p>
                ) : (
                  <p key="pres">{t`You are currently not representing any faction. To represent one, activate a role in one of your factions below.`}</p>
                )}
                <div className="factionlist">{factions.map((faction) => {
                  const { fid } = faction;
                  let titleClass = 'faction-title';
                  if (fid === activeFaction) {
                    titleClass += ' active';
                  }
                  if (faction.isHidden) {
                    titleClass += ' hidden';
                  }

                  if (fid === selected) {
                    return (
                      <div
                        key={faction.fid}
                        className="factionlist-item-edit"
                      >
                        <FactionAvatar
                          fid={fid}
                          avatarId={faction.avatarId}
                        /><span className={titleClass}>{faction.title}</span>
                        <p className="faction-description">{faction.description}</p>
                        <p>{t`Your Roles:`}
                          {faction.roles.map((role) => (
                            <span
                              role="button"
                              tabIndex={-1}
                              key={role.frid}
                              onClick={() => setActiveRole(role.frid)}
                            >
                              <img
                                className="chatflag"
                                src={cdn`${getUrlsFromMediaIdAndName(activeCustomFlagId)[0]}`}
                                alt=""
                              /> {role.name}
                            </span>
                          ))}
                          <br />
                          <span>{t`(click a role to activate it)`}</span>
                        </p>
                        <p>
                          <input
                            type="checkbox"
                            checked={faction.isHidden}
                            onChange={(evt) => {
                              setFactionHidden(faction.fid, evt.target.checked);
                            }}
                          /> {t`Hide from profile`}
                        </p>
                        <p>
                          <button
                            type="button"
                            className={confirmLeave ? 'confirm' : undefined}
                            onClick={() => {
                              if (!confirmLeave) {
                                setConfirmLeave(true);
                              }
                              /* */
                            }}
                          >
                            {/* t: button for leaving a faction, it asks for confirmation */}
                            {(confirmLeave) ? t`Confirm Leave` : t`Leave Faction`}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              link('FACTION', {
                                target: 'parent',
                                reuse: true,
                                args: { fid },
                              });
                            }}
                          >
                            {t`Open Faction`}
                          </button>
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={faction.fid}
                      className="factionlist-item"
                      onClick={() => {
                        setSelected(fid);
                        setConfirmLeave(false);
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <FactionAvatar
                        fid={fid}
                        avatarId={faction.avatarId}
                      /><span className={titleClass}>{faction.title}</span>
                    </div>
                  );
                })}</div>
              </React.Fragment>
            ) : (
              <p key="nofl">{t`You are currently not a member of any faction.`}</p>
            )}
            <h2>{t`Create a new Faction here:`}</h2>
            <button
              type="button"
              onClick={changePage('create')}
            >
              {t`Create`}
            </button>
          </React.Fragment>
        );
      })()}
    </div>
  );
};

export default MyFactions;
