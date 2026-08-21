import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {readSession} from "../../../lib/admin-auth";
import AdminDashboard from "../../admin/admin-dashboard";

export const dynamic="force-dynamic";

export default function AshuDashboard(){
  const session=readSession(cookies().get("cut_admin_session")?.value);
  if(!session) redirect("/ashu");
  return <AdminDashboard email={session.email}/>;
}
