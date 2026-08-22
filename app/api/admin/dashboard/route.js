import {NextResponse} from "next/server";
import {sql} from "@neondatabase/serverless";

async function safe(db, query, fallback = []) {
  try { return await query(db); } catch { return fallback; }
}

export async function GET(){
  if(!process.env.DATABASE_URL) return NextResponse.json({error:"Database is not configured"},{status:503});
  try{
    const db=sql(process.env.DATABASE_URL);
    const [u,p,reviews,events,sources,recent,latestEvent,latestSource] = await Promise.all([
      safe(db, d=>d`SELECT count(*)::int AS count FROM universities`, [{count:0}]),
      safe(db, d=>d`SELECT count(*)::int AS count FROM programs WHERE COALESCE(is_active,true)=true`, [{count:0}]),
      safe(db, d=>d`SELECT status,count(*)::int AS count FROM admin_reviews GROUP BY status`, []),
      safe(db, d=>d`SELECT count(*)::int AS count FROM monitor_events`, [{count:0}]),
      safe(db, d=>d`SELECT count(*)::int AS count, count(*) FILTER (WHERE status='ok')::int AS healthy, count(*) FILTER (WHERE status <> 'ok')::int AS unhealthy FROM monitor_sources`, [{count:0,healthy:0,unhealthy:0}]),
      safe(db, d=>d`SELECT id, action, entity_type, entity_id, details, created_at FROM admin_audit_logs ORDER BY created_at DESC LIMIT 12`, []),
      safe(db, d=>d`SELECT detected_at,event_type,summary FROM monitor_events ORDER BY detected_at DESC LIMIT 1`, []),
      safe(db, d=>d`SELECT last_checked_at FROM monitor_sources WHERE last_checked_at IS NOT NULL ORDER BY last_checked_at DESC LIMIT 1`, [])
    ]);
    const reviewMap=Object.fromEntries(reviews.map(r=>[r.status,r.count]));
    return NextResponse.json({
      metrics:{
        universities:u[0]?.count||0,
        programs:p[0]?.count||0,
        events:events[0]?.count||0,
        sources:sources[0]?.count||0,
        healthySources:sources[0]?.healthy||0,
        failedSources:sources[0]?.unhealthy||0,
        needsReview:reviewMap.needs_review||0,
        inProgress:reviewMap.in_progress||0,
        verified:reviewMap.verified||0,
        published:reviewMap.published||0,
        lastEvent:latestEvent[0]||null,
        lastChecked:latestSource[0]?.last_checked_at||null
      },
      activity:recent
    });
  }catch(error){return NextResponse.json({error:"Unable to load admin metrics"},{status:500})}
}
