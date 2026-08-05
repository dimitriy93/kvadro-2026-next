import {Metadata} from "next";
import VideoSurveillancePage from "./ui/video-surveillance.ui";

export const metadata: Metadata = {
    title: 'Видеонаблюдение',
};

export default function Page() {
    return <VideoSurveillancePage/>;
}