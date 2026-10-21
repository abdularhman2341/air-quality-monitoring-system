import { Link } from 'react-router-dom'

function Header() {

    return(

          <header>
            <div>
                <h1>Gas Monitor</h1>
                <p>MEASURE . MONITOR . BREATHE SAFER</p>
            </div>
            <nav>
                <Link to="/">Dashboard</Link>
                <Link to="/add-sensor">Add Sensor</Link>
                <Link to="/history">History & Alerts</Link>
            </nav>
            <div>
                <span>System Online</span> 
                <button>Log Out</button>
            </div>
        </header>


    )

}
export default Header