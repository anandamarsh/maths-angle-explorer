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
const DEFAULT_DISCUSSIT_URL = import.meta.env.PROD
  ? 'https://discussit-widget.vercel.app'
  : 'http://localhost:5001';
const LOCAL_DISCUSSIT_URL = (import.meta.env.VITE_DISCUSSIT_URL ?? DEFAULT_DISCUSSIT_URL).replace(/\/$/, '');

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
  const pageUrl = typeof window !== 'undefined' ? window.location.href : SHARE_URL;
  const iframeUrl = `${LOCAL_DISCUSSIT_URL}/?url=${encodeURIComponent(pageUrl)}&theme=dark`;
  const openComposer = () => {
    const frame = document.querySelector('iframe[data-discussit-comments="true"]');
    frame?.contentWindow?.postMessage({ type: 'discussit:open-composer' }, '*');
  };

  return (
    <div style={{ padding: '0.75rem 1rem 1.25rem', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={openComposer}
          style={{
            border: '1px solid rgba(250, 204, 21, 0.7)',
            borderRadius: '999px',
            background: 'rgba(250, 204, 21, 0.08)',
            color: '#fde047',
            padding: '0.55rem 1rem',
            fontSize: '0.76rem',
            fontWeight: 900,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          New comment
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <iframe
          data-discussit-comments="true"
          src={iframeUrl}
          title="DiscussIt comments"
          style={{
            width: '100%',
            height: '100%',
            minHeight: '100%',
            border: 0,
            borderRadius: '18px',
            background: 'transparent',
          }}
        />
      </div>
    </div>
  );
}
