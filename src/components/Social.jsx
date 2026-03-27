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

const DISQUS_SHORTNAME = 'interactive-maths';
const GAME_ID          = 'maths-angle-explorer';
const SHARE_TITLE      = 'Check out this maths game on Interactive Maths!';

/** Just the four share buttons — no heading. */
export function SocialShare() {
  const url = window.location.href;
  return (
    <div style={{ display: 'flex', gap: '1rem', padding: '1.25rem', justifyContent: 'center' }}>
      <TwitterShareButton url={url} title={SHARE_TITLE}>
        <XIcon size={48} round />
      </TwitterShareButton>
      <FacebookShareButton url={url}>
        <FacebookIcon size={48} round />
      </FacebookShareButton>
      <WhatsappShareButton url={url} title={SHARE_TITLE}>
        <WhatsappIcon size={48} round />
      </WhatsappShareButton>
      <LinkedinShareButton url={url} title={SHARE_TITLE}>
        <LinkedinIcon size={48} round />
      </LinkedinShareButton>
    </div>
  );
}

/** Just the Disqus thread — no share buttons. */
export function SocialComments() {
  const url = window.location.href;
  return (
    <div style={{ padding: '0 1rem 2rem' }}>
      <DiscussionEmbed
        shortname={DISQUS_SHORTNAME}
        config={{ url, identifier: GAME_ID, title: GAME_ID, language: 'en' }}
      />
    </div>
  );
}
