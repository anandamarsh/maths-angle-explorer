import { useEffect, useRef } from 'react';
import {
  TwitterShareButton,
  FacebookShareButton,
  WhatsappShareButton,
  LinkedinShareButton,
  XIcon,
  FacebookIcon,
  WhatsappIcon,
  LinkedinIcon,
} from 'react-share';
import { texts } from '../texts';

const SHARE_TITLE      = texts.generic.social.shareTitle;
const SHARE_URL        = texts.generic.shellShareUrl;
const CUSDIS_HOST      = 'https://cusdis.com';
const CUSDIS_APP_ID    = 'b7cf3bec-b283-485f-9db9-8e7f3cfac3c2';
const COMMENTS_PAGE_ID = texts.generic.social.commentsPageId;
const COMMENTS_TITLE   = texts.generic.social.commentsTitle;

function ensureCusdisLoaded() {
  const existing = document.querySelector('script[data-cusdis-script="true"]');
  if (existing) return existing;

  const script = document.createElement('script');
  script.async = true;
  script.defer = true;
  script.src = `${CUSDIS_HOST}/js/cusdis.es.js`;
  script.dataset.cusdisScript = 'true';
  document.body.appendChild(script);
  return script;
}

/** Just the four share buttons — no heading. */
export function SocialShare() {
  return (
    <div style={{ display: 'flex', gap: '1rem', padding: '1rem 1.25rem 1.25rem', justifyContent: 'flex-start' }}>
      <TwitterShareButton url={SHARE_URL} title={SHARE_TITLE}>
        <XIcon size={48} round />
      </TwitterShareButton>
      <FacebookShareButton url={SHARE_URL}>
        <FacebookIcon size={48} round />
      </FacebookShareButton>
      <WhatsappShareButton url={SHARE_URL} title={SHARE_TITLE}>
        <WhatsappIcon size={48} round />
      </WhatsappShareButton>
      <LinkedinShareButton url={SHARE_URL} title={SHARE_TITLE}>
        <LinkedinIcon size={48} round />
      </LinkedinShareButton>
    </div>
  );
}

/** Just the Cusdis thread — no share buttons. */
export function SocialComments() {
  const hostRef = useRef(null);

  useEffect(() => {
    const script = ensureCusdisLoaded();

    const stretchIframe = () => {
      const iframe = hostRef.current?.querySelector('iframe');
      if (iframe) {
        iframe.style.height = '100%';
        iframe.style.minHeight = '100%';
      }
    };

    const renderCusdis = () => {
      const api = window.CUSDIS;
      if (api?.renderTo && hostRef.current) {
        api.renderTo(hostRef.current);
        requestAnimationFrame(stretchIframe);
        setTimeout(stretchIframe, 150);
      }
    };

    if (window.CUSDIS) {
      renderCusdis();
      return;
    }

    script?.addEventListener('load', renderCusdis, { once: true });
    return () => script?.removeEventListener('load', renderCusdis);
  }, []);

  return (
    <div style={{ padding: '1rem 1rem 1.25rem', height: '100%', boxSizing: 'border-box' }}>
      <div
        id="cusdis_thread"
        ref={hostRef}
        data-host={CUSDIS_HOST}
        data-app-id={CUSDIS_APP_ID}
        data-page-id={COMMENTS_PAGE_ID}
        data-page-url={SHARE_URL}
        data-page-title={COMMENTS_TITLE}
        data-theme="dark"
        style={{ height: '100%', minHeight: '100%' }}
      />
    </div>
  );
}
