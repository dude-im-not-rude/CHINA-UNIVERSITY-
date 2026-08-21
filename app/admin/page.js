import AdminLogin from "./admin-login";

export const metadata={title:"Admin | ChinaUniTracker"};

// Admin entry route — keep this as a real App Router page.
export default function AdminPage(){
  return <AdminLogin/>;
}
