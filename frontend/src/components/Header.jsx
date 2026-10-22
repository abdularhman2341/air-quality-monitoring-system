import logo from '../assets/logo.svg'
import { Link } from 'react-router-dom'
import './Header.css'

function Header() {

    return(

          <header className='header'>
            <div className='brand'>
                <img src={logo} alt="Gas Monitor logo" width="40" />
                <h1>Gas Monitor</h1>
                <p>MEASURE . MONITOR . BREATHE SAFER</p>
            </div>
            <nav className='nav'>
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