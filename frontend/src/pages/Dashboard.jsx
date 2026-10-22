function Dashboard() {
    return (
        <section className="status-card">
            <h2>SAFE</h2>
            <p>No gas leak detected</p>

            <div className="gas-card">
                <h3>Gas Level</h3>
                <p>184 ppm</p>
            </div>
            <div className="sensor-card">
                <h3>Sensor  Status</h3>
                <p>Active</p>
                <p>GS-01</p>
            </div>
            <div className="alerts-card">
                <h3>No active alerts</h3>
                <p>Everything looks normal.</p>
            </div>
        </section>
    )
}
export default Dashboard