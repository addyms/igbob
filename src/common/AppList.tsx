import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import React, { useEffect } from 'react';
import { appsSelector } from '../redux/selectors/selectors';
import { connect } from 'react-redux';
import { App } from '../redux/reducers/bond';
import { useAuth0 } from '@auth0/auth0-react';
import { setApps } from '../redux/actions/actions';

interface StateProps {
  apps: Map<number, App>;
}

interface DispatchProps {
  setApps: typeof setApps;
}

interface OwnProps {
  onClick: (appId: number) => void;
}

type AppListProps = StateProps & DispatchProps & OwnProps;

function AppList(props: AppListProps) {
  const { apps, setApps, onClick } = props;

  const { getAccessTokenSilently } = useAuth0();

  async function fetchApps() {
    try {
      const accessToken = await getAccessTokenSilently();
      const response = await fetch("https://igbob.herokuapp.com/apps/all-apps", {
        headers: { Authorization: `Bearer ${accessToken}`},
      });
      const parseResponse = await response.json();
      setApps(parseResponse);
    } catch (err) {
      console.error(err.message);
    }
  }

  // fetch apps after initial render
  useEffect( () => {
    fetchApps();
  }, []);

  return (
    <List component="nav">
      {apps && [...apps].map(([appId, app]) => {
        return (
          <ListItem
            button
            onClick={() => onClick(appId)}
            key={appId}
          >
            <ListItemText primary={app.name} secondary={"App Id: " + app.app_id}/>
          </ListItem>
        )
      })}
    </List>
  );
}

const mapStateToProps = (state) => ({
  apps: appsSelector(state),
});

const mapDispatchToProps = {
  setApps
}

export default connect<StateProps, DispatchProps, OwnProps>(mapStateToProps, mapDispatchToProps)(AppList);