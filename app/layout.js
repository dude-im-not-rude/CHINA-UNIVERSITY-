import "./globals.css";
import "./mobile.css";
import GlobalUI from "./components/global-ui";

export const metadata={title:"ChinaUniTracker",description:"China university, scholarship and CSCA discovery platform"};
export const viewport={width:"device-width",initialScale:1,viewportFit:"cover"};

export default function RootLayout({children}){
  return <html lang="en"><body>{children}<GlobalUI/></body></html>;
}
