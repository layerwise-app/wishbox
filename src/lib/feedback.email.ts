import { statusLabels, type FeedbackStatus } from '~/lib/feedback';

// Emails to an idea's author when the team acts on their idea. Pure, so the
// tests can check escaping; sending lives in `feedback.notify.ts`.

export type IdeaEmail = { subject: string; html: string; text: string };
/** Where the email is going: the project's name and the idea page to link to. */
export type IdeaEmailContext = { projectName: string; url: string };

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
// Subjects are one line, and titles or names saved through the API could hold line breaks.
const oneLine = (value: string) => value.replace(/\s+/g, ' ').trim();
const quoteHtml = (title: string) => `“<strong>${escapeHtml(title)}</strong>”`;

export function statusChangeEmail(context: IdeaEmailContext, idea: { title: string; status: FeedbackStatus; message: string }): IdeaEmail {
  const [name, title, label] = [oneLine(context.projectName), oneLine(idea.title), statusLabels[idea.status]];
  return compose(context, `Your idea “${title}” is now ${label.toLowerCase()}`, {
    html: `${escapeHtml(name)} moved your idea ${quoteHtml(title)} to ${label}.`,
    text: `${name} moved your idea “${title}” to ${label}.`
  }, idea.message);
}

export function mergedEmail(context: IdeaEmailContext, idea: { title: string; targetTitle: string }): IdeaEmail {
  const [name, title, target] = [oneLine(context.projectName), oneLine(idea.title), oneLine(idea.targetTitle)];
  return compose(context, `Your idea “${title}” was merged`, {
    html: `${escapeHtml(name)} merged your idea ${quoteHtml(title)} into ${quoteHtml(target)}. Votes and comments moved with it.`,
    text: `${name} merged your idea “${title}” into “${target}”. Votes and comments moved with it.`
  });
}

function compose(context: IdeaEmailContext, subject: string, lead: { html: string; text: string }, note = ''): IdeaEmail {
  const footer = `You’re getting this because you posted this idea on the ${oneLine(context.projectName)} board.`;
  const html = [
    `<p>${lead.html}</p>`,
    note ? `<blockquote style="margin:0 0 16px;padding-left:12px;border-left:3px solid #d4d4d8;color:#52525b;white-space:pre-line">${escapeHtml(note)}</blockquote>` : '',
    `<p><a href="${escapeHtml(context.url)}">View the idea</a></p>`,
    `<p style="color:#71717a;font-size:12px">${escapeHtml(footer)}</p>`
  ].join('');
  const text = [lead.text, note, `View the idea: ${context.url}`, footer].filter(Boolean).join('\n\n');
  return { subject, html, text };
}
