/*
 * user faction overview
 */
import React, { useMemo, useState } from 'react';
import { t } from 'ttag';

import { cdn } from '../../utils/utag.js';
import { getUrlsFromMediaIdAndName } from '../../utils/media/utils.js';
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
  const [factions, activeFactionRole, fetched] = useProfile((profile) => [
    profile.factions,
    profile.activeFactionRole,
  ]);
  const link = useLink();

  const [activeFaction, activeFactionTitle, activeRoleName, activeCustomFlagId] = useMemo(() => {
    for (let i = 0; i < factions.length; i += 1) {
      const roles = factions[i];
      for (let u = 0; u < roles.length; u += 1) {
        if (roles[u].frid === activeFactionRole) {
          return [factions[i].fid, factions[i].title, roles[u].name, roles[u].customFlagId];
        }
      }
    }
    return [null, '', '', null];
  }, [factions, activeFactionRole]);

  if (!fetched) {
    return (<div className="content">{t`Loading...`}</div>);
  }

  return (
    <div className="content">
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
                className="modallink"
                onClick={() => {
                  /* */
                }}
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
                        key={role.frid}
                        onClick={() => {
                        /* */
                        }}
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
                      onChange={() => {
                        /* */
                      }}
                    /> {t`Hide from profile`}
                  </p>
                  <p>
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
                onClick={() => setSelected(fid)}
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
