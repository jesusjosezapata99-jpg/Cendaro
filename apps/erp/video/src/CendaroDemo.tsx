import { Composition } from "remotion";

import { AnalyticsScene } from "./scenes/AnalyticsScene";
import { CatalogScene } from "./scenes/CatalogScene";
import { DashboardScene } from "./scenes/DashboardScene";
import { InventoryScene } from "./scenes/InventoryScene";
import { OrderFlowScene } from "./scenes/OrderFlowScene";

const FPS = 30;

export const CendaroDemo: React.FC = () => {
  return (
    <>
      <Composition
        id="HeroDashboard"
        component={DashboardScene}
        durationInFrames={FPS * 8}
        fps={FPS}
        width={1280}
        height={720}
      />
      <Composition
        id="InventoryFlow"
        component={InventoryScene}
        durationInFrames={FPS * 8}
        fps={FPS}
        width={1280}
        height={720}
      />
      <Composition
        id="OrdersFlow"
        component={OrderFlowScene}
        durationInFrames={FPS * 8}
        fps={FPS}
        width={1280}
        height={720}
      />
      <Composition
        id="CatalogFlow"
        component={CatalogScene}
        durationInFrames={FPS * 8}
        fps={FPS}
        width={1280}
        height={720}
      />
      <Composition
        id="AnalyticsFlow"
        component={AnalyticsScene}
        durationInFrames={FPS * 6}
        fps={FPS}
        width={1280}
        height={720}
      />
    </>
  );
};
