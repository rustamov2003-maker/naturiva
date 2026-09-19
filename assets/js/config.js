/* NATURIVA runtime configuration.
 * Edit here; no rebuild needed.
 *
 * assistantEndpoint
 *   Leave null to run the offline knowledge engine (assets/js/engine.js).
 *   Set to your RAG/LLM endpoint (e.g. "/api/ask") and the assistant will POST
 *   {question, history} and render the returned Result (see engine.js header).
 *   The local engine stays in place as a fallback if the endpoint fails.
 *
 * analytics
 *   Events are pushed to window.dataLayer as {event, ...props}. Connect Google
 *   Tag Manager, GA4 or Plausible here when an account exists. No credentials
 *   are included on purpose.
 *   Events: knowledge_question_submitted, knowledge_answer_viewed, book_viewed,
 *   amazon_clicked, faq_opened, search_used, learning_path_started,
 *   learning_path_completed, newsletter_signup (reserved for a future signup form).
 */
window.NATURIVA_CONFIG = {
  assistantEndpoint: null,
  analytics: {
    debug: false          // true logs every event to the console
    // gtmId: "GTM-XXXXXXX"   add when the account exists
  }
};
