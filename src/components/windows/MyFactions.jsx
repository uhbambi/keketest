/*
 * user faction overview
 */
import React, { useMemo, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { t } from 'ttag';

import { cdn } from '../../utils/utag.js';
import { getUrlsFromMediaIdAndName } from '../../utils/media/utils.js';
import {
  changeProfile, changeUserFaction,
} from '../../store/actions/thunks.js';
import useProfile from '../hooks/useProfile.js';
import useLink from '../hooks/link.js';


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
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState([]);
  const [factions, activeFactionRole, fetched] = useProfile((profile) => [
    profile.factions,
    profile.activeFactionRole,
  ]);
  const link = useLink();
  const dispatch = useDispatch();

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
      changeUserFaction(fid, { isHidden }),
    );
    setErrors((oErrors) => {
      if (respErrors) {
        return respErrors;
      }
      return oErrors.length ? [] : oErrors;
    });
  }, []);

  if (!fetched) {
    return (<div className="content">{t`Loading...`}</div>);
  }

  return (
    <div className="content">
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
    </div>
  );
};

export default MyFactions;
