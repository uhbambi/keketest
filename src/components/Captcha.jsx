/*
 * Form to ask for captcha.
 * Offers input for captchas, parent needs to provide a form and
 * get "captcha" and "captchaid" values
 */

/* eslint-disable jsx-a11y/no-autofocus */

import React, { useState, useEffect, useCallback } from 'react';
import { t } from 'ttag';
import { IoReloadCircleSharp } from 'react-icons/io5';

import { shardOrigin } from '../store/actions/fetch';
import { getRandomString } from '../core/utils';

async function getUrlAndId() {
  const url = `${shardOrigin}/captcha.svg`;
  const resp = await fetch(url, {
    cache: 'no-cache',
  });
  if (resp.ok) {
    const captchaid = resp.headers.get('captcha-id');
    const challengeNeeded = resp.headers.get('challenge-needed') === '1';
    const svgBlob = await resp.blob();
    return [URL.createObjectURL(svgBlob), captchaid, challengeNeeded];
  }
  return null;
}

const floatStyle = {
  width: '100%',
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%,-50%)',
};

/*
 * autoload: Load captcha immediately and autofocus input textbox
 * width: width of the captcha image
 */
const Captcha = ({
  autoload, width, setLegit, onReadyStateChange,
}) => {
  const [captchaData, setCaptchaData] = useState({});
  const [challengeSolution, setChallengeSolution] = useState(null);
  const [errors, setErrors] = useState([]);
  const [imgLoaded, setImgLoaded] = useState(false);

  const reloadCaptcha = useCallback(async () => {
    /*
     * load Cahptcha
     */
    if (imgLoaded) {
      setImgLoaded(false);
    }
    const captchaResponse = await getUrlAndId();
    if (!captchaResponse) {
      setErrors([t`Could not load captcha`]);
      return;
    }
    const [svgUrl, captchaid, challengeNeeded] = captchaResponse;

    /*
     * solve JS Challenge in Worker on first load
     */
    if (challengeNeeded && challengeSolution === null) {
      const worker = new Worker(`/challenge.js?cb=${getRandomString()}`);
      // TODO Timeout
      worker.onmessage = (e) => {
        setChallengeSolution(e.data);
        worker.terminate();
      };
      // empty string for waiting
      setChallengeSolution('');
    }

    setCaptchaData({ url: svgUrl, id: captchaid });
  }, [imgLoaded, challengeSolution]);

  useEffect(() => {
    if (autoload) {
      reloadCaptcha();
    }
  // intentionally only executed on first render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (onReadyStateChange) {
      onReadyStateChange(challengeSolution !== '' && !!captchaData.id);
    }
  }, [challengeSolution, captchaData.id, onReadyStateChange]);

  const contWidth = width || 100;

  return (
    <>
      <p>
        {t`Type the characters from the following image:`}
        &nbsp;
        <span style={{ fontSize: 11 }}>
          ({t`Tip: Not case-sensitive; I and l are the same`})
        </span>
      </p>
      {errors.map((error) => (
        <p key={error} className="errormessage">
          <span>{t`Error`}</span>:&nbsp;{error}
        </p>
      ))}
      <div
        style={{
          width: `${contWidth}%`,
          paddingTop: `${Math.floor(contWidth * 0.6)}%`,
          position: 'relative',
          display: 'inline-block',
          backgroundColor: '#e0e0e0',
        }}
      >
        {(captchaData.url)
          ? (
            <img
              style={{
                ...floatStyle,
                // width: '100%',
                opacity: (imgLoaded) ? 1 : 0,
                transition: '100ms',
              }}
              src={captchaData.url}
              alt="CAPTCHA"
              onLoad={() => {
                setErrors([]);
                setImgLoaded(true);
              }}
              onError={() => {
                setErrors([t`Could not load captcha`]);
              }}
            />
          )
          : (
            <span
              style={floatStyle}
              role="button"
              tabIndex={0}
              title={t`Load Captcha`}
              className="modallink"
              onClick={reloadCaptcha}
              onKeyPress={reloadCaptcha}
            >
              {t`Click to Load Captcha`}
            </span>
          )}
      </div>
      <p>
        {t`Can't read? Reload:`}&nbsp;
        <span
          role="button"
          tabIndex={-1}
          title={t`Reload`}
          className="modallink"
          style={{ fontSize: 28 }}
          onClick={reloadCaptcha}
        >
          <IoReloadCircleSharp />
        </span>
      </p>
      <input
        name="captcha"
        placeholder={t`Enter Characters`}
        type="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        onChange={() => setLegit && setLegit(true)}
        autoFocus={autoload}
        style={{
          width: '6em',
          fontSize: 21,
          margin: 5,
        }}
      />
      <input type="hidden" name="captchaid" value={captchaData.id || '0'} />
      <input
        type="hidden"
        name="challengesolution"
        value={challengeSolution || ''}
      />
    </>
  );
};

export default React.memo(Captcha);
