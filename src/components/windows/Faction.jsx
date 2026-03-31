/*
 * faction
 */
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { t } from 'ttag';

import { cdn } from '../../utils/utag.js';
import { getUrlsFromMediaIdAndName } from '../../utils/media/utils.js';
import WindowContext from '../context/window.js';
import {
  requestFactionInfo,
  requestFactionMembers,
  requestFactionBans,
  requestLeaveFaction,
  requestJoinFaction,
  requestAddFactionRole,
  requestRemoveFactionRole,
  requestKickBanFactionMember,
} from '../../store/actions/fetch.js';
import {
  applyPatches,
} from '../../store/actions/index.js';
import { FACTIONLVL } from '../../core/constants.js';
import useLink from '../hooks/link.js';
import ClipboardCopyField from '../ClipboardCopyField.jsx';
import { buildPopUpUrl } from './popUpAvailable.js';

/* eslint-disable max-len */

const Faction = () => {
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [errors, setErrors] = useState([]);
  /* { faction, powerlvl } */
  const [factionData, setFactionData] = useState(null);
  /*
   * [{
   *   uid,
   *   name,
   *   username,
   *   avatarId,
   *   roles: [frid1, frid2, ...],
   * }, ...]
   */
  const [memberData, setMemberData] = useState(null);
  const [banData, setBanData] = useState(null);
  const {
    args,
    setArgs,
    setTitle,
  } = useContext(WindowContext);
  const { activeTab = 'overview', name } = args;
  const link = useLink();
  const dispatch = useDispatch();

  const tabNames = {
    overview: t`Overview`,
    members: t`Members`,
    bans: t`Bans`,
    roles: t`Roles`,
    edit: t`Profile`,
    invites: t`Invites`,
  };

  const setActiveTab = useCallback((tab) => {
    setArgs({
      activeTab: tab,
    });
    setTitle(`${name} - ${tabNames[tab]}`);
    setErrors([]);
    setConfirm(false);
    setSubmitting(false);
    setSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setArgs, setTitle]);

  useEffect(() => {
    (async () => {
      const reqFactionData = await requestFactionInfo(name);
      if (reqFactionData.errors) {
        setErrors(reqFactionData.errors);
        return;
      }
      setFactionData(reqFactionData);
    })();
  }, [name]);

  useEffect(() => {
    (async () => {
      if (!factionData) {
        return;
      }
      if (activeTab === 'members' && !memberData) {
        const reqMemberData = await requestFactionMembers(name);
        if (reqMemberData.errors) {
          setErrors(reqMemberData.errors);
          return;
        }
        const { members } = reqMemberData;
        const { roles } = factionData.faction;
        for (const member of members) {
          let userPowerlvl = -1;
          if (member.roles?.length) {
            userPowerlvl = Math.max(
              ...member.roles.map((frid) => roles.find(
                (fr) => fr.frid === frid,
              ).factionlvl),
            );
          }
          let powerlvlName;
          if (userPowerlvl >= 100) {
            powerlvlName = 'sovereign';
          } else if (userPowerlvl >= 80) {
            powerlvlName = 'magistrate';
          } else if (userPowerlvl >= 50) {
            powerlvlName = 'noble';
          } else {
            powerlvlName = 'peasant';
          }
          member.powerlvl = userPowerlvl;
          member.powerlvlName = powerlvlName;
        }
        setMemberData(members);
      } else if (activeTab === 'bans' && !banData) {
        const reqBanData = await requestFactionBans(name);
        if (reqBanData.errors) {
          setErrors(reqBanData.errors);
          return;
        }
        setBanData(reqBanData);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberData, banData, factionData, activeTab]);

  const submitLeaveFaction = useCallback(async (fid) => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    const {
      errors: respErrors, patches,
    } = await requestLeaveFaction(fid);
    if (patches) {
      dispatch(applyPatches(patches));
    }
    if (respErrors) {
      setErrors(respErrors);
    } else {
      setErrors([]);
    }
    setConfirm(false);
    setSubmitting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitting]);

  const submitJoinFaction = useCallback(async (fid) => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    const {
      errors: respErrors, patches,
    } = await requestJoinFaction(fid);
    if (patches) {
      dispatch(applyPatches(patches));
    }
    if (respErrors) {
      setErrors(respErrors);
    } else {
      setErrors([]);
    }
    setConfirm(false);
    setSubmitting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitting]);

  const submitAddFactionRole = useCallback(async (uid, frid) => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    const { errors: respErrors } = await requestAddFactionRole(uid, frid);
    if (respErrors) {
      setErrors(respErrors);
    } else {
      setErrors([]);
      setMemberData((members) => {
        const memberIndex = members?.findIndex((m) => m.uid === uid);
        if (memberIndex !== -1) {
          const newMembers = [...members];
          const member = newMembers[memberIndex];
          newMembers[memberIndex] = {
            ...member,
            roles: [...member.roles, frid],
          };
          return newMembers;
        }
        return members;
      });
    }
    setConfirm(false);
    setSubmitting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitting]);

  const submitRemoveFactionRole = useCallback(async (uid, frid) => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    const { errors: respErrors } = await requestRemoveFactionRole(uid, frid);
    if (respErrors) {
      setErrors(respErrors);
    } else {
      setErrors([]);
      setMemberData((members) => {
        const memberIndex = members?.findIndex((m) => m.uid === uid);
        if (memberIndex !== -1) {
          const newMembers = [...members];
          const member = newMembers[memberIndex];
          newMembers[memberIndex] = {
            ...member,
            roles: member.roles.filter((r) => r !== frid),
          };
          return newMembers;
        }
        return members;
      });
    }
    setConfirm(false);
    setSubmitting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitting]);

  const submitKickBanMember = useCallback(async (uid, fid, isBan) => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    const {
      errors: respErrors,
    } = await requestKickBanFactionMember(uid, fid, isBan);
    if (respErrors) {
      setErrors(respErrors);
    } else {
      setErrors([]);
      setMemberData((members) => members.filter((m) => m.uid !== uid));
    }
    setConfirm(false);
    setSubmitting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitting]);

  if (!factionData) {
    return (
      <div className="content" key="loading">
        {errors.map((error) => (
          <p key={error} className="errormessage">
            <span>{t`Error`}</span>:&nbsp;{error}</p>
        ))}
        {!errors.length && (<h3>{t`Loading...`}</h3>)}
      </div>
    );
  }

  const { powerlvl, faction } = factionData;

  const availableTabs = [
    'overview', 'members', 'bans', 'roles', 'edit', 'invites',
  ].filter((p) => {
    switch (p) {
      case 'edit':
      case 'roles':
      case 'bans':
        return powerlvl >= FACTIONLVL.MAGISTRATE;
      case 'invites':
        return powerlvl >= FACTIONLVL.NOBLE;
      default:
        return true;
    }
  });

  let powerlvlName;
  if (powerlvl >= 100) {
    powerlvlName = 'sovereign';
  } else if (powerlvl >= 80) {
    powerlvlName = 'magistrate';
  } else if (powerlvl >= 50) {
    powerlvlName = 'noble';
  } else if (powerlvl >= 0 || faction.isMember) {
    powerlvlName = 'peasant';
  } else {
    powerlvlName = 'stranger';
  }

  let didPrintErrors = false;
  let content = null;
  if (!availableTabs.includes(activeTab)) {
    content = <h3 key="notallowed">{t`Not Allowed`}</h3>;
  } else if (activeTab === 'overview') {
    /* ============================== OVERVIEW =============================== */
    const [
      mediaUrl, thumbUrl,
    ] = getUrlsFromMediaIdAndName(faction.avatarId, 'avatar');
    content = (
      <div className={`factionwin-${activeTab}`} key={activeTab}>
        {(thumbUrl) && (
          <div
            className="factionavatar"
            style={{
              backgroundImage: `url(${cdn`${thumbUrl}`})`,
            }}
            onClick={(evt) => {
              evt.stopPropagation();
              link('PLAYER', {
                reuse: true,
                target: 'blank',
                args: { uri: mediaUrl },
              });
            }}
          />
        )}
        <span className="factionlist-key">{t`Description`}: </span>{faction.description}<br />
        <span className="factionlist-key">{t`Members`}: </span>{faction.memberCount}<br />
        {(faction.roles.find((r) => r.customFlagId)) && (
          <React.Fragment key="rolelist">
            <span className="factionlist-key">{t`Role Flags`}: </span>
            {faction.roles.map(({ customFlagId }) => {
              const [flagUrl] = getUrlsFromMediaIdAndName(customFlagId);
              if (!flagUrl) {
                return null;
              }
              return (
                <img
                  key={customFlagId}
                  className="chatflag"
                  src={cdn`${flagUrl}`}
                  alt=""
                />
              );
            })}<br />
          </React.Fragment>
        )}
        <div className="form-actions">
          <ClipboardCopyField
            hideField="true"
            text={window.location.origin + buildPopUpUrl('FACTION', { name })}
          />
          {(powerlvl === -1 && faction.isPublic) && (
            <button
              key="joinbutton"
              type="button"
              disabled={submitting}
              title={t`Join Faction`}
              onClick={() => {
                submitJoinFaction(faction.fid);
              }}
            >
              {t`Join Faction`}
            </button>
          )}
          {(powerlvl !== -1) && (
            <button
              key="leavebutton"
              type="button"
              disabled={submitting}
              className={confirm ? 'confirm' : undefined}
              title={t`Leave Faction`}
              onClick={() => {
                if (confirm !== 'leave') {
                  setConfirm('leave');
                  return;
                }
                submitLeaveFaction(faction.fid);
              }}
            >
              {/* t: button for leaving a faction, it asks for confirmation */}
              {(confirm === 'leave') ? t`Confirm Leave` : t`Leave Faction`}
            </button>
          )}
        </div>
      </div>
    );
  } else if (activeTab === 'members') {
    /* =============================== MEMBERS =============================== */
    if (!memberData) {
      return null;
    }
    const canBan = powerlvl >= FACTIONLVL.NOBLE;
    const canChangeRoles = powerlvl >= FACTIONLVL.MAGISTRATE;
    didPrintErrors = true;
    content = (
      <div className={`factionwin-${activeTab}`} key={activeTab}>
        <div className="factionlist">{memberData.map((member) => {
          const {
            name: memberName, username, avatarId,
            powerlvlName: memberPowerlvlName,
          } = member;
          const [, thumb] = getUrlsFromMediaIdAndName(avatarId, 'avatar');

          const item = (
            <div
              key={username}
              className="factionlist-item"
              onClick={() => {
                if (username === selected) {
                  setSelected(null);
                } else {
                  setSelected(username);
                }
                setErrors([]);
                setConfirm(false);
              }}
              role="button"
              tabIndex={0}
            >
              {(thumb) && (
                <img
                  src={cdn`${thumb}`}
                  loading="lazy"
                  className="memberlist-avatar"
                  alt=""
                />
              )}
              <span className="memberlist-name">{memberName}</span>
              <span className="memberlist-username">[{faction.name}]</span>
              <span className={`factionlist-square powerlvl-${memberPowerlvlName}`} />
            </div>
          );

          if (username === selected && (canBan || canChangeRoles)) {
            const {
              powerlvl: memberPowerlvl, roles: memberRolesIds,
            } = member;
            const canBanMember = canBan && powerlvl > memberPowerlvl;
            const canChangeMemberRoles = canChangeRoles && powerlvl >= memberPowerlvl;
            return (
              <div
                key={`edit-${faction.fid}`}
              >
                {item}
                <div className="factionlist-edit">
                  {errors.map((error) => (
                    <p key={error} className="errormessage">
                      <span>{t`Error`}</span>:&nbsp;{error}</p>
                  ))}
                  {(canChangeMemberRoles) && (
                  <React.Fragment key="changeroles">
                    <span className="factionlist-key">{t`Remove Roles`}: </span>
                    {faction.roles.filter((role) => memberRolesIds.includes(role.frid)).map((role) => {
                      const [flagUrl] = getUrlsFromMediaIdAndName(role.customFlagId);
                      let roleClassName = 'factionlist-role';
                      const { factionlvl } = role;
                      if (factionlvl >= 100) {
                        roleClassName += ' powerlvl-sovereign';
                      } else if (factionlvl >= 80) {
                        roleClassName += ' powerlvl-magistrate';
                      } else if (factionlvl >= 50) {
                        roleClassName += ' powerlvl-noble';
                      } else {
                        roleClassName += ' powerlvl-peasant';
                      }
                      return (
                        <span
                          key={role.frid}
                          role="button"
                          tabIndex={-1}
                          className={roleClassName}
                          onClick={() => submitRemoveFactionRole(member.uid, role.frid)}
                        >
                          {(flagUrl) && (
                          <img
                            className="chatflag"
                            src={cdn`${flagUrl}`}
                            alt=""
                          />
                          )} {role.name}
                        </span>
                      );
                    })}<br />
                    <span className="factionlist-key">{t`Assign Roles`}: </span>
                    {faction.roles.filter((role) => !memberRolesIds.includes(role.frid)).map((role) => {
                      const [flagUrl] = getUrlsFromMediaIdAndName(role.customFlagId);
                      let roleClassName = 'factionlist-role';
                      const { factionlvl } = role;
                      if (factionlvl >= 100) {
                        roleClassName += ' powerlvl-sovereign';
                      } else if (factionlvl >= 80) {
                        roleClassName += ' powerlvl-magistrate';
                      } else if (factionlvl >= 50) {
                        roleClassName += ' powerlvl-noble';
                      } else {
                        roleClassName += ' powerlvl-peasant';
                      }
                      return (
                        <span
                          key={role.frid}
                          role="button"
                          tabIndex={-1}
                          className={roleClassName}
                          onClick={() => submitAddFactionRole(member.uid, role.frid)}
                        >
                          {(flagUrl) && (
                          <img
                            className="chatflag"
                            src={cdn`${flagUrl}`}
                            alt=""
                          />
                          )} {role.name}
                        </span>
                      );
                    })}<br />
                    <span className="factionlist-key">{t`(click a role to assign or remove it)`}</span>
                  </React.Fragment>
                  )}
                  {(canBanMember) && (
                  <React.Fragment key="kickban">
                    <div className="form-actions">
                      <button
                        type="button"
                        className={confirm === 'kick' ? 'confirm' : undefined}
                        disabled={submitting}
                        onClick={() => {
                          if (!confirm) {
                            setConfirm('kick');
                            return;
                          }
                          submitKickBanMember(member.uid, faction.fid, false);
                        }}
                      >
                        {/* t: button for kicking a user from a faction, it asks for confirmation */}
                        {(confirm === 'kick') ? t`Confirm Kick` : t`Kick`}
                      </button>
                      <button
                        type="button"
                        className={confirm === 'ban' ? 'confirm' : undefined}
                        disabled={submitting}
                        onClick={() => {
                          if (!confirm) {
                            setConfirm('ban');
                            return;
                          }
                          submitKickBanMember(member.uid, faction.fid, true);
                        }}
                      >
                        {/* t: button for banning a user from a faction, it asks for confirmation */}
                        {(confirm === 'ban') ? t`Confirm Leave` : t`Leave`}
                      </button>
                    </div>
                  </React.Fragment>
                  )}
                </div>
              </div>
            );
          }
          return item;
        })}
        </div>
      </div>
    );
  }

  return (
    <div className="content" key="factionpage">
      <h2>{faction.title}</h2>
      <h3><span className={`factionlist-square powerlvl-${powerlvlName}`} /> [{faction.name}]</h3>
      {availableTabs.map((tab, ind) => (
        <React.Fragment key={tab}>
          <span
            role="button"
            tabIndex={-1}
            className={
              (activeTab === tab) ? 'modallink selected' : 'modallink'
            }
            onClick={() => setActiveTab(tab)}
          >{tabNames[tab]}</span>
          {(ind !== availableTabs.length - 1)
            && <span className="hdivider" />}
        </React.Fragment>
      ))}
      <div className="modaldivider" />
      {!didPrintErrors && errors.map((error) => (
        <p key={error} className="errormessage">
          <span>{t`Error`}</span>:&nbsp;{error}</p>
      ))}
      {content}
    </div>
  );
};

export default Faction;
