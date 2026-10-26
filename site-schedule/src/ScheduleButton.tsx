// The "This week's live calls" card on the vtimpact.com landing page, between the Impact Enterprise card and the
// portal tiles. One tap takes people straight to /schedule, without going through the Impact Investment portal.
import { Link } from "react-router-dom";
import { Icon } from "./live-calls";
import { SCHEDULE_PATH } from "./paths";
import "./schedule.css";

export function ScheduleButton() {
  return (
    <section className="ss-card" aria-labelledby="schedule-title">
      <span className="ss-card__icon" aria-hidden="true">
        <Icon name="calendar" size={26} />
      </span>
      <div className="ss-card__text">
        <p className="ss-card__eyebrow">
          <span className="ss-card__dot" aria-hidden="true" />
          Live calls
        </p>
        <h2 className="ss-card__title" id="schedule-title">
          This week&rsquo;s schedule
        </h2>
        <p className="ss-card__lead">Every live call, Monday to Sunday, in your time zone.</p>
      </div>
      <Link className="ss-card__enter" to={SCHEDULE_PATH}>
        View schedule
        <span className="visually-hidden">, this week&rsquo;s live calls</span>
        <Icon name="chevron-right" size={16} className="ss-card__arrow" />
      </Link>
    </section>
  );
}
