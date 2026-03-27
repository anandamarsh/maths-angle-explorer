import { DiscussionEmbed } from 'disqus-react';
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

// ─── CONFIG — only these 2 lines change per game ───────────────────────────
const DISQUS_SHORTNAME = 'interactive-maths';
const GAME_ID = 'maths-angle-explorer';
// ──────────────────────────────────────────────────────────────────────────

const SHARE_TITLE = 'Check out this maths game on Interactive Maths!';

export default function Social() {
  const url = window.location.href;

  return (
    <div style={{ marginTop: '2rem', padding: '1rem' }}>

      {/* ── SHARE BUTTONS ── */}
      <h3 style={{ marginBottom: '0.5rem' }}>Share this game</h3>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
        <TwitterShareButton url={url} title={SHARE_TITLE}>
          <XIcon size={40} round />
        </TwitterShareButton>
        <FacebookShareButton url={url}>
          <FacebookIcon size={40} round />
        </FacebookShareButton>
        <WhatsappShareButton url={url} title={SHARE_TITLE}>
          <WhatsappIcon size={40} round />
        </WhatsappShareButton>
        <LinkedinShareButton url={url} title={SHARE_TITLE}>
          <LinkedinIcon size={40} round />
        </LinkedinShareButton>
      </div>

      {/* ── COMMENTS + LOGIN ── */}
      {/* Disqus handles login via Google, Facebook, Twitter, email */}
      {/* Each game gets its own isolated comment thread via GAME_ID */}
      <DiscussionEmbed
        shortname={DISQUS_SHORTNAME}
        config={{
          url: url,
          identifier: GAME_ID,
          title: GAME_ID,
          language: 'en',
        }}
      />

    </div>
  );
}
