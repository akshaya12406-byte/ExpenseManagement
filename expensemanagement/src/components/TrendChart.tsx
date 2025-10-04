import { memo, useEffect, useRef } from 'react';
import {
  Chart,
  ChartConfiguration,
  ChartType,
  registerables,
} from 'chart.js';

Chart.register(...registerables);

export type TrendChartProps<TType extends ChartType> = {
  config: ChartConfiguration<TType>;
  className?: string;
};

function TrendChart<TType extends ChartType>({ config, className }: TrendChartProps<TType>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<TType> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    // Destroy previous instance before creating a new one.
    chartRef.current?.destroy();
    chartRef.current = new Chart(canvas, config);

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [config]);

  return <canvas ref={canvasRef} className={className} />;
}

export default memo(TrendChart);
