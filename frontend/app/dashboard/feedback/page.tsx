"use client";

import { useState } from "react";
import { useAuthFetch } from "../hooks/useAuthFetch";
import DashboardNavbar from "../components/DashboardNavbar";
import styles from "./page.module.css";

export default function FeedbackPage() {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { fetchWithAuth } = useAuthFetch();

  const handleSubmit = async () => {
    if (!message.trim() || submitting) return;
    try {
      setSubmitting(true);
      const response = await fetchWithAuth('/api/reports/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: 'General Feedback',
          company_url: '',
          reported_summary: '',
          similarity_score: 0,
          user_message: `Message: ${message.trim()}`,
          metadata: {}
        })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to submit feedback');
      }
      setMessage('');
      alert('Thank you! Your feedback has been submitted.');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <DashboardNavbar />
      <div className={styles.container}>
        <div className={styles.row1}>
          <h1 className={styles.title}>Report general feedback, issues or anything else</h1>
        </div>
        <div className={styles.row2}>
          <div className={styles.feedbackForm}>
            <p className={styles.description}>
              An email will be sent to the support team who will get to it right away.
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your feedback here..."
              className={styles.textarea}
              maxLength={3000}
            />
            <div className={styles.buttonContainer}>
              <button
                onClick={handleSubmit}
                disabled={!message.trim() || submitting}
                className={styles.sendButton}
              >
                {submitting ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
