import "./index.css";
import { Composition } from "remotion";
import { HelloWorld } from "./HelloWorld";
import { Logo } from "./HelloWorld/Logo";
import { SportsNewsComp } from "./SportsNews";
import { BusinessNewsComp } from "./BusinessNews";
import { TrafficNewsComp } from "./TrafficNews";
import { TechNewsComp } from "./TechNews";
import { DynamicNewsComp } from "./DynamicNews";
import { DynamicNewsData } from "./DynamicNews/types";
import dynamicNewsDefault from "./dynamic_news.json";

// Each <Composition> is an entry in the sidebar!

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        // You can take the "id" to render a video:
        // npx remotion render HelloWorld
        id="HelloWorld"
        component={HelloWorld}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        // You can override these props for each render:
        // https://www.remotion.dev/docs/parametrized-rendering
        defaultProps={{
          titleText: "Welcome to Remotion",
          titleColor: "#000000",
          logoColor1: "#91EAE4",
          logoColor2: "#86A8E7",
        }}
      />

      {/* Mount any React component to make it show up in the sidebar and work on it individually! */}
      <Composition
        id="OnlyLogo"
        component={Logo}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          logoColor1: "#91dAE2",
          logoColor2: "#86A8E7",
        }}
      />

      <Composition
        id="SportsNews"
        component={SportsNewsComp}
        durationInFrames={1101}
        fps={30}
        width={1080}
        height={1920}
      />

      <Composition
        id="BusinessNews"
        component={BusinessNewsComp}
        durationInFrames={809}
        fps={30}
        width={1080}
        height={1920}
      />

      <Composition
        id="TrafficNews"
        component={TrafficNewsComp}
        durationInFrames={858}
        fps={30}
        width={1080}
        height={1920}
      />

      <Composition
        id="TechNews"
        component={TechNewsComp}
        durationInFrames={1807}
        fps={30}
        width={1080}
        height={1920}
      />

      <Composition
        id="DynamicNews"
        component={DynamicNewsComp}
        durationInFrames={1800}
        defaultProps={dynamicNewsDefault as DynamicNewsData}
        calculateMetadata={async () => {
          // Dynamic data loaded from src/dynamic_news.json
          const data: DynamicNewsData = require('./dynamic_news.json');
          return {
            durationInFrames: data.totalDurationInFrames || 1800,
            props: data,
          };
        }}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
