function Header() {
    return(
          <header>
            <div>
                <h1>Gas Monitor</h1>
                <p>MEASUR.MONITOR.BREATHE SAFER</p>
            </div>
            <nav>
                <a href="/">Dashboard</a>
                <a href="/add-sensor">Add Sensor</a>
                <a href="/history">History & Alerts</a>
            </nav>
            <div>
                <span>System Online</span> 
                <button>Log Out</button>
            </div>
        </header>


    )

}
export default Header