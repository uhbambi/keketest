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
  const [errors, setErrors] = useState([]);
  const [factionData, setFactionData] = useState(null);
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
      if (activeTab === 'members' && !memberData) {
        const reqMemberData = await requestFactionMembers(name);
        if (reqMemberData.errors) {
          setErrors(reqMemberData.errors);
          return;
        }
        setMemberData(reqMemberData);
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
  }, [memberData, banData, activeTab]);

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

  let content = null;
  if (!availableTabs.includes(activeTab)) {
    content = <h3 key="notallowed">{t`Not Allowed`}</h3>;
  } else if (activeTab === 'overview') {
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
    content = (
      <React.Fragment key={activeTab} />
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
      {errors.map((error) => (
        <p key={error} className="errormessage">
          <span>{t`Error`}</span>:&nbsp;{error}</p>
      ))}
      {content}
    </div>
  );
};

export default Faction;
