import React from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import GaugeUniversal from "../gauge/gaugeuniversal";
import "./StatCard.css";

function StatCard({ value, valueCheckIn, label, unit, maxvalue, flag }) {
  const formattedValue =
    unit === "COP"
      ? new Intl.NumberFormat("es-CO", {
          style: "currency",
          currency: "COP",
          minimumFractionDigits: 0,
        }).format(Number(value))
      : "(" + value + "%)";

  return (
    <Card
      className="stat-card"
      style={{ backgroundColor: "#353d54", color: "#fff" }}
    >
      <CardContent>
        {/** 
          <div>
            <GaugeUniversal valor={value} maxvalue={maxvalue} flag={flag} />
            <Typography
              className="card-description"
              style={{
                marginTop: "10px",
              }}
            >
              {label}
            </Typography>
          </div>
*/}

        <p className="card-title">
          {valueCheckIn}
          {formattedValue}
        </p>
        <p className="card-description">{label}</p>
      </CardContent>
    </Card>
  );
}

export default StatCard;
