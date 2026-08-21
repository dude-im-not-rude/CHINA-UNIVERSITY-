import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {readSession} from "../../../lib/admin-auth";
import AdminDashboard from "../admin-dashboard";

export const dynamic="force-dynamic";

export default function Dashboard(){
 const session=readSession(cookies().get("cut_admin_session")?.value);
 if(!session) redirect("/admin");
 return <AdminDashboard email={session.email}/>;
}
