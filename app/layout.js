import "./globals.css";
import GlobalUI from "./components/global-ui";

export const metadata={title:"ChinaUniTracker",description:"China university, scholarship and CSCA discovery platform"};

export default function RootLayout({children}){
  return <html lang="en"><body>{children}<GlobalUI/></body></html>;
}
