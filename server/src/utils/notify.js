/**
 * Simple Slack webhook notification for cron job failures.
 * Set SLACK_WEBHOOK_URL env var to enable.
 */
export async function notifyCronFailure(jobName, error) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn(`[notify] SLACK_WEBHOOK_URL not set — skipping Slack notification for ${jobName} failure`);
    return;
  }

  const payload = {
    text: `:warning: *Cron job failed: ${jobName}*\n\`\`\`${error.message || error}\`\`\`\nTime: ${new Date().toISOString()}`
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.error(`[notify] Slack webhook returned ${res.status}`);
    }
  } catch (e) {
    console.error('[notify] Failed to send Slack notification:', e.message);
  }
}

export async function notifyCronSuccess(jobName, summary) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const payload = {
    text: `:white_check_mark: *Cron job succeeded: ${jobName}*\n${summary}\nTime: ${new Date().toISOString()}`
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error('[notify] Failed to send Slack notification:', e.message);
  }
}
